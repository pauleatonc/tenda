import type { AnalyticsEventName } from './events.js'
import { AnalyticsEvents } from './events.js'

export type AuthMethod = 'email' | 'google'
export type ProductCreateMode = 'manual' | 'variant' | 'assisted' | 'import'
export type SaleSource = 'wizard' | 'inventory'
export type PaymentProofDecision = 'approve' | 'reject'
export type ProductCountBucket = '0' | '1-5' | '6-20' | '20+'

export type AnalyticsConsent = {
  analytics: boolean
  adStorage?: boolean
}

export type AnalyticsUserProperties = {
  role?: string
  has_bank_details?: 'true' | 'false'
  has_mercadopago?: 'true' | 'false'
  product_count_bucket?: ProductCountBucket
  organisation_id?: string
}

type EmptyParams = Record<string, never>

export type EventParamsMap = {
  [AnalyticsEvents.landingCtaClick]: { cta?: string }
  [AnalyticsEvents.signUp]: { method: AuthMethod }
  [AnalyticsEvents.login]: { method: AuthMethod }
  [AnalyticsEvents.emailVerified]: EmptyParams
  [AnalyticsEvents.passwordResetRequested]: EmptyParams

  [AnalyticsEvents.productCreated]: { mode: ProductCreateMode }
  [AnalyticsEvents.stockAdjusted]: EmptyParams
  [AnalyticsEvents.bankDetailsSaved]: { account_count?: number }
  [AnalyticsEvents.mercadopagoConnected]: EmptyParams
  [AnalyticsEvents.mercadopagoDisconnected]: EmptyParams
  [AnalyticsEvents.activationCompleted]: EmptyParams

  [AnalyticsEvents.saleWizardStepViewed]: { step: string }
  [AnalyticsEvents.saleCreated]: {
    payment_method: string
    delivery_mode: string
    item_count: number
  }
  [AnalyticsEvents.saleLinkPublished]: {
    payment_method: string
    source: SaleSource
  }
  [AnalyticsEvents.offerLinkCopied]: { payment_method?: string }
  [AnalyticsEvents.offerLinkEmailed]: { payment_method?: string }
  [AnalyticsEvents.paymentProofReviewed]: { decision: PaymentProofDecision }
  [AnalyticsEvents.saleCancelled]: EmptyParams
  [AnalyticsEvents.saleRefunded]: EmptyParams
  [AnalyticsEvents.shipmentLabelGenerated]: EmptyParams
  [AnalyticsEvents.shipmentDispatched]: EmptyParams

  [AnalyticsEvents.buyerOfferViewed]: { payment_method?: string }
  [AnalyticsEvents.buyerCheckoutStarted]: { payment_method?: string }
  [AnalyticsEvents.buyerCheckoutCompleted]: { payment_method?: string }
  [AnalyticsEvents.buyerMpRedirect]: EmptyParams
  [AnalyticsEvents.buyerProofUploaded]: EmptyParams
  [AnalyticsEvents.buyerStatusViewed]: { payment_method?: string }
}

export type AnalyticsParams<E extends AnalyticsEventName> = EventParamsMap[E]

export type AnalyticsPrimitive = string | number | boolean

export type AnalyticsParamBag = Record<string, AnalyticsPrimitive>

export type AnalyticsAdapter = {
  track: (event: string, params?: AnalyticsParamBag) => void
  pageView?: (path: string, title?: string) => void
  screenView?: (screenName: string, params?: AnalyticsParamBag) => void
  setUserId?: (userId: string | null) => void
  setUserProperties?: (properties: AnalyticsParamBag) => void
  setConsent?: (consent: AnalyticsConsent) => void
}

export type AnalyticsClient = {
  track: <E extends AnalyticsEventName>(
    event: E,
    params?: EventParamsMap[E],
  ) => void
  pageView: (path: string, title?: string) => void
  screenView: (screenName: string, params?: AnalyticsParamBag) => void
  setUser: (userId: string | null) => void
  setUserProperties: (properties: AnalyticsUserProperties) => void
  setConsent: (consent: AnalyticsConsent) => void
}

export function productCountBucket(count: number): ProductCountBucket {
  if (count <= 0) return '0'
  if (count <= 5) return '1-5'
  if (count <= 20) return '6-20'
  return '20+'
}
