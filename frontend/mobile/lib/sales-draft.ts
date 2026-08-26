import * as SecureStore from 'expo-secure-store'

import { newIdempotencyKey } from './graphql'

export const SALE_DRAFT_STORAGE_KEY = 'tenda.mobile.sale-draft.v1'

export type SaleDeliveryMode = 'shipping' | 'pickup'
export type SalePaymentMethod = 'bank_transfer' | 'cash' | 'mercado_pago'
export type SaleDraftStep = 'products' | 'terms' | 'review' | 'result'

export type SaleDraftLine = {
  id: string
  productId: string
  productName: string
  available: number
  reserved: number
  quantity: string
  referencePrice: string | null
  unitSalePrice: string
  discountPercent: string
}

export type SaleDraftResult = {
  orderId: string
  orderNumber: string
  publicUrl: string
}

export type SaleDraft = {
  version: 1
  step: SaleDraftStep
  idempotencyKey: string
  lines: SaleDraftLine[]
  deliveryMode: SaleDeliveryMode
  paymentMethod: SalePaymentMethod
  result: SaleDraftResult | null
  updatedAt: string
}

export type SaleDraftValidation = {
  valid: boolean
  lineErrors: Record<string, string[]>
  productErrors: Record<string, string>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDraftLine(value: unknown): value is SaleDraftLine {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.productId === 'string' &&
    typeof value.productName === 'string' &&
    typeof value.available === 'number' &&
    Number.isFinite(value.available) &&
    typeof value.reserved === 'number' &&
    Number.isFinite(value.reserved) &&
    typeof value.quantity === 'string' &&
    (typeof value.referencePrice === 'string' || value.referencePrice === null) &&
    typeof value.unitSalePrice === 'string' &&
    typeof value.discountPercent === 'string'
  )
}

function isDraftResult(value: unknown): value is SaleDraftResult {
  if (!isRecord(value)) return false
  return (
    typeof value.orderId === 'string' &&
    typeof value.orderNumber === 'string' &&
    typeof value.publicUrl === 'string'
  )
}

function isSaleDraft(value: unknown): value is SaleDraft {
  if (!isRecord(value)) return false
  const steps: SaleDraftStep[] = ['products', 'terms', 'review', 'result']
  const deliveryModes: SaleDeliveryMode[] = ['shipping', 'pickup']
  const paymentMethods: SalePaymentMethod[] = [
    'bank_transfer',
    'cash',
    'mercado_pago',
  ]
  return (
    value.version === 1 &&
    typeof value.step === 'string' &&
    steps.includes(value.step as SaleDraftStep) &&
    typeof value.idempotencyKey === 'string' &&
    value.idempotencyKey.length > 0 &&
    Array.isArray(value.lines) &&
    value.lines.every(isDraftLine) &&
    typeof value.deliveryMode === 'string' &&
    deliveryModes.includes(value.deliveryMode as SaleDeliveryMode) &&
    typeof value.paymentMethod === 'string' &&
    paymentMethods.includes(value.paymentMethod as SalePaymentMethod) &&
    (value.result === null || isDraftResult(value.result)) &&
    typeof value.updatedAt === 'string'
  )
}

export function createEmptySaleDraft(): SaleDraft {
  return {
    version: 1,
    step: 'products',
    idempotencyKey: newIdempotencyKey(),
    lines: [],
    deliveryMode: 'shipping',
    paymentMethod: 'bank_transfer',
    result: null,
    updatedAt: new Date().toISOString(),
  }
}

export function createSaleDraftLine(product: {
  id: string
  name: string
  salePrice: string | null
  stock: { available: number; reserved: number }
}): SaleDraftLine {
  return {
    id: newIdempotencyKey(),
    productId: product.id,
    productName: product.name,
    available: product.stock.available,
    reserved: product.stock.reserved,
    quantity: '1',
    referencePrice: product.salePrice,
    unitSalePrice: product.salePrice ?? '',
    discountPercent: '',
  }
}

export function calculateDiscountedPrice(
  referencePrice: string | null,
  discountPercent: string,
): string | null {
  if (referencePrice === null || referencePrice.trim() === '') return null
  const price = Number(referencePrice)
  const percentage = Number(discountPercent.replace(',', '.'))
  if (
    !Number.isInteger(price) ||
    price < 0 ||
    !Number.isFinite(percentage) ||
    percentage < 0 ||
    percentage > 100
  ) {
    return null
  }
  return String(Math.round(price * (1 - percentage / 100)))
}

/**
 * Validates stock per product, not per row. Repeating a product at a distinct
 * effective price is valid, but all of its lines still consume one shared
 * availability figure.
 */
export function validateSaleDraftLines(lines: SaleDraftLine[]): SaleDraftValidation {
  const lineErrors: Record<string, string[]> = {}
  const productErrors: Record<string, string> = {}
  const totals = new Map<string, { quantity: number; available: number; name: string }>()

  for (const line of lines) {
    const errors: string[] = []
    const quantity = Number(line.quantity)
    const price = Number(line.unitSalePrice)
    if (!Number.isInteger(quantity) || quantity <= 0) {
      errors.push('Ingresa una cantidad entera mayor que cero.')
    }
    if (!Number.isInteger(price) || price < 0) {
      errors.push('Ingresa un precio CLP entero, sin decimales.')
    }
    if (errors.length) lineErrors[line.id] = errors

    if (Number.isInteger(quantity) && quantity > 0) {
      const current = totals.get(line.productId)
      totals.set(line.productId, {
        quantity: (current?.quantity ?? 0) + quantity,
        available: Math.min(current?.available ?? line.available, line.available),
        name: line.productName,
      })
    }
  }

  for (const [productId, total] of totals) {
    if (total.quantity > total.available) {
      productErrors[productId] =
        `${total.name}: seleccionaste ${total.quantity}, pero hay ${total.available} ` +
        'disponibles entre todas sus líneas de precio.'
    }
  }

  return {
    valid:
      lines.length > 0 &&
      Object.keys(lineErrors).length === 0 &&
      Object.keys(productErrors).length === 0,
    lineErrors,
    productErrors,
  }
}

export async function loadSaleDraft(): Promise<SaleDraft> {
  const stored = await SecureStore.getItemAsync(SALE_DRAFT_STORAGE_KEY)
  if (!stored) return createEmptySaleDraft()
  try {
    const parsed: unknown = JSON.parse(stored)
    return isSaleDraft(parsed) ? parsed : createEmptySaleDraft()
  } catch {
    return createEmptySaleDraft()
  }
}

export async function saveSaleDraft(draft: SaleDraft): Promise<void> {
  await SecureStore.setItemAsync(
    SALE_DRAFT_STORAGE_KEY,
    JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  )
}

export async function clearSaleDraft(): Promise<void> {
  await SecureStore.deleteItemAsync(SALE_DRAFT_STORAGE_KEY)
}
