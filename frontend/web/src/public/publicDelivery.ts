import {
  formatRutInput,
  isValidChileLocation,
  isValidChileanRut,
  type BuyerView,
} from '@tenda/api-client'

export type DeliveryDraft = {
  recipientName: string
  recipientTaxId: string
  phone: string
  deliveryAddress: string
  deliveryCommune: string
  deliveryRegion: string
  deliveryNotes: string
}

export type DeliveryErrors = Partial<Record<keyof DeliveryDraft, string>>

export function emptyDeliveryDraft(): DeliveryDraft {
  return {
    recipientName: '',
    recipientTaxId: '',
    phone: '',
    deliveryAddress: '',
    deliveryCommune: '',
    deliveryRegion: '',
    deliveryNotes: '',
  }
}

export function deliveryDraftFromBuyer(buyer?: BuyerView | null): DeliveryDraft {
  if (!buyer) return emptyDeliveryDraft()
  return {
    recipientName: buyer.recipientName,
    recipientTaxId: buyer.recipientTaxId,
    phone: buyer.phone,
    deliveryAddress: buyer.deliveryAddress,
    deliveryCommune: buyer.deliveryCommune,
    deliveryRegion: buyer.deliveryRegion,
    deliveryNotes: buyer.deliveryNotes,
  }
}

export function hasRequiredDelivery(buyer?: BuyerView | null): boolean {
  if (!buyer) return false
  return (
    Boolean(buyer.recipientName.trim()) &&
    isValidChileanRut(buyer.recipientTaxId) &&
    Boolean(buyer.phone.trim()) &&
    Boolean(buyer.deliveryAddress.trim()) &&
    isValidChileLocation(buyer.deliveryRegion, buyer.deliveryCommune)
  )
}

export function validateDeliveryDraft(draft: DeliveryDraft): DeliveryErrors {
  const errors: DeliveryErrors = {}
  if (!draft.recipientName.trim()) {
    errors.recipientName = 'Escribe quién recibe el pedido.'
  }
  if (!isValidChileanRut(draft.recipientTaxId)) {
    errors.recipientTaxId = 'Ingresa el RUT de quien recibe.'
  }
  if (!draft.phone.trim()) {
    errors.phone = 'Ingresa un teléfono de contacto.'
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
  return errors
}

export function formatDeliveryRut(value: string): string {
  return formatRutInput(value)
}

export function buyerDisplayName(buyer?: BuyerView | null, recipientName = ''): string {
  const current = buyer?.fullName.trim() ?? ''
  if (current && current !== 'Comprador') return current
  return recipientName.trim() || current
}
