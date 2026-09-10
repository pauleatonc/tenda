import { isValidChileLocation, isValidChileanRut } from '@tenda/api-client'

import { newIdempotencyKey } from '../lib/http'

export type PublicCheckoutDraft = {
  version: 2
  step: 1 | 2 | 3
  fullName: string
  email: string
  phone: string
  recipientName: string
  recipientTaxId: string
  deliveryAddress: string
  deliveryCommune: string
  deliveryRegion: string
  wantsTaxData: boolean
  taxId: string
  taxName: string
  taxBusinessActivity: string
  taxAddress: string
  taxCommune: string
  taxRegion: string
  taxEmail: string
  paymentMethod: string
  detailsIdempotencyKey: string
  checkoutIdempotencyKey: string
}

function storageKey(token: string): string {
  return `tenda.public-checkout.${token}.v1`
}

export function createPublicCheckoutDraft(): PublicCheckoutDraft {
  return {
    version: 2,
    step: 1,
    fullName: '',
    email: '',
    phone: '',
    recipientName: '',
    recipientTaxId: '',
    deliveryAddress: '',
    deliveryCommune: '',
    deliveryRegion: '',
    wantsTaxData: false,
    taxId: '',
    taxName: '',
    taxBusinessActivity: '',
    taxAddress: '',
    taxCommune: '',
    taxRegion: '',
    taxEmail: '',
    paymentMethod: '',
    detailsIdempotencyKey: newIdempotencyKey(),
    checkoutIdempotencyKey: newIdempotencyKey(),
  }
}

function isDraft(value: unknown): value is PublicCheckoutDraft {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PublicCheckoutDraft>
  return (
    candidate.version === 2 &&
    typeof candidate.step === 'number' &&
    typeof candidate.fullName === 'string' &&
    typeof candidate.paymentMethod === 'string' &&
    typeof candidate.detailsIdempotencyKey === 'string' &&
    typeof candidate.checkoutIdempotencyKey === 'string'
  )
}

export function loadPublicCheckoutDraft(
  token: string,
  storage: Storage = window.sessionStorage,
): PublicCheckoutDraft {
  try {
    const raw = storage.getItem(storageKey(token))
    if (!raw) return createPublicCheckoutDraft()
    const parsed: unknown = JSON.parse(raw)
    return isDraft(parsed)
      ? { ...createPublicCheckoutDraft(), ...parsed }
      : createPublicCheckoutDraft()
  } catch {
    return createPublicCheckoutDraft()
  }
}

export function savePublicCheckoutDraft(
  token: string,
  draft: PublicCheckoutDraft,
  storage: Storage = window.sessionStorage,
): void {
  storage.setItem(storageKey(token), JSON.stringify(draft))
}

export function clearPublicCheckoutDraft(
  token: string,
  storage: Storage = window.sessionStorage,
): void {
  storage.removeItem(storageKey(token))
}

export type CheckoutErrors = Partial<
  Record<
    | 'fullName'
    | 'contact'
    | 'phone'
    | 'recipientName'
    | 'recipientTaxId'
    | 'deliveryAddress'
    | 'deliveryCommune'
    | 'deliveryRegion'
    | 'taxId'
    | 'taxName'
    | 'taxEmail'
    | 'paymentMethod',
    string
  >
>

export function requiresCheckoutDelivery(
  deliveryMode: string,
  paymentMethod?: string,
): boolean {
  return deliveryMode === 'shipping' || paymentMethod === 'bank_transfer'
}

export function validateContactAndDelivery(
  draft: PublicCheckoutDraft,
  deliveryMode: string,
  paymentMethod?: string,
): CheckoutErrors {
  const errors: CheckoutErrors = {}
  if (!draft.fullName.trim()) errors.fullName = 'Escribe tu nombre.'
  if (!draft.email.trim() && !draft.phone.trim()) {
    errors.contact = 'Ingresa un email o teléfono para recibir novedades.'
  }
  if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
    errors.contact = 'Revisa el formato del email.'
  }
  if (requiresCheckoutDelivery(deliveryMode, paymentMethod)) {
    if (!draft.phone.trim()) {
      errors.phone = 'Ingresa un teléfono de contacto.'
    }
    if (!draft.recipientName.trim()) {
      errors.recipientName = 'Escribe quién recibe el pedido.'
    }
    if (!isValidChileanRut(draft.recipientTaxId)) {
      errors.recipientTaxId = 'Ingresa el RUT de quien recibe.'
    }
    if (!draft.deliveryAddress.trim()) {
      errors.deliveryAddress = 'Escribe la dirección de despacho.'
    }
    if (!draft.deliveryRegion.trim()) {
      errors.deliveryRegion = 'Selecciona la región.'
    }
    if (!draft.deliveryCommune.trim()) {
      errors.deliveryCommune = 'Selecciona la comuna.'
    } else if (
      draft.deliveryRegion &&
      !isValidChileLocation(draft.deliveryRegion, draft.deliveryCommune)
    ) {
      errors.deliveryCommune = 'Selecciona una comuna de esa región.'
    }
  }
  if (draft.wantsTaxData) {
    if (!draft.taxId.trim()) errors.taxId = 'Escribe el RUT.'
    if (!draft.taxName.trim()) errors.taxName = 'Escribe el nombre o razón social.'
    if (draft.taxEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.taxEmail)) {
      errors.taxEmail = 'Revisa el email tributario.'
    }
  }
  return errors
}
