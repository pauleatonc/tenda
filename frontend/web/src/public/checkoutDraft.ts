import { newIdempotencyKey } from '../lib/http'

export type PublicCheckoutDraft = {
  version: 1
  step: 1 | 2 | 3
  fullName: string
  email: string
  phone: string
  recipientName: string
  deliveryAddress: string
  deliveryCommune: string
  deliveryCity: string
  wantsTaxData: boolean
  taxId: string
  taxName: string
  taxBusinessActivity: string
  taxAddress: string
  taxCommune: string
  taxCity: string
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
    version: 1,
    step: 1,
    fullName: '',
    email: '',
    phone: '',
    recipientName: '',
    deliveryAddress: '',
    deliveryCommune: '',
    deliveryCity: '',
    wantsTaxData: false,
    taxId: '',
    taxName: '',
    taxBusinessActivity: '',
    taxAddress: '',
    taxCommune: '',
    taxCity: '',
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
    candidate.version === 1 &&
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
    return isDraft(parsed) ? parsed : createPublicCheckoutDraft()
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
    | 'recipientName'
    | 'deliveryAddress'
    | 'deliveryCommune'
    | 'deliveryCity'
    | 'taxId'
    | 'taxName'
    | 'taxEmail'
    | 'paymentMethod',
    string
  >
>

export function validateContactAndDelivery(
  draft: PublicCheckoutDraft,
  deliveryMode: string,
): CheckoutErrors {
  const errors: CheckoutErrors = {}
  if (!draft.fullName.trim()) errors.fullName = 'Escribe tu nombre.'
  if (!draft.email.trim() && !draft.phone.trim()) {
    errors.contact = 'Ingresa un email o teléfono para recibir novedades.'
  }
  if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
    errors.contact = 'Revisa el formato del email.'
  }
  if (deliveryMode === 'shipping') {
    if (!draft.recipientName.trim()) {
      errors.recipientName = 'Escribe quién recibe el pedido.'
    }
    if (!draft.deliveryAddress.trim()) {
      errors.deliveryAddress = 'Escribe la dirección de despacho.'
    }
    if (!draft.deliveryCommune.trim()) {
      errors.deliveryCommune = 'Escribe la comuna.'
    }
    if (!draft.deliveryCity.trim()) errors.deliveryCity = 'Escribe la ciudad.'
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
