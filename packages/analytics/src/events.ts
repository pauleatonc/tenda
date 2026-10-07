/** Canonical GA4 / Firebase event names for Tenda. */
export const AnalyticsEvents = {
  landingCtaClick: 'landing_cta_click',
  signUp: 'sign_up',
  login: 'login',
  emailVerified: 'email_verified',
  passwordResetRequested: 'password_reset_requested',

  productCreated: 'product_created',
  stockAdjusted: 'stock_adjusted',
  bankDetailsSaved: 'bank_details_saved',
  mercadopagoConnected: 'mercadopago_connected',
  mercadopagoDisconnected: 'mercadopago_disconnected',
  activationCompleted: 'activation_completed',

  saleWizardStepViewed: 'sale_wizard_step_viewed',
  saleCreated: 'sale_created',
  saleLinkPublished: 'sale_link_published',
  offerLinkCopied: 'offer_link_copied',
  offerLinkEmailed: 'offer_link_emailed',
  paymentProofReviewed: 'payment_proof_reviewed',
  saleCancelled: 'sale_cancelled',
  saleRefunded: 'sale_refunded',
  shipmentLabelGenerated: 'shipment_label_generated',
  shipmentDispatched: 'shipment_dispatched',

  buyerOfferViewed: 'buyer_offer_viewed',
  buyerCheckoutStarted: 'buyer_checkout_started',
  buyerCheckoutCompleted: 'buyer_checkout_completed',
  buyerMpRedirect: 'buyer_mp_redirect',
  buyerProofUploaded: 'buyer_proof_uploaded',
  buyerStatusViewed: 'buyer_status_viewed',
} as const

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents]
