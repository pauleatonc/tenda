import {
  AnalyticsEvents,
  createAnalytics,
  createGtagAdapter,
  createNoopAnalytics,
  initGtag,
  type AnalyticsClient,
  type AnalyticsConsent,
} from '@tenda/analytics'

export { AnalyticsEvents }
export type { AnalyticsClient, AnalyticsConsent }

const CONSENT_KEY = 'tenda.analytics.consent'
const MEASUREMENT_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim() ?? ''

let client: AnalyticsClient | null = null

export function getStoredConsent(): AnalyticsConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { analytics?: boolean }
    if (typeof parsed.analytics !== 'boolean') return null
    return { analytics: parsed.analytics, adStorage: false }
  } catch {
    return null
  }
}

export function persistConsent(consent: AnalyticsConsent): void {
  localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: consent.analytics }))
}

export function getAnalytics(): AnalyticsClient {
  if (client) return client
  if (!MEASUREMENT_ID) {
    client = createNoopAnalytics()
    return client
  }
  initGtag(MEASUREMENT_ID)
  client = createAnalytics(createGtagAdapter({ measurementId: MEASUREMENT_ID }))
  const stored = getStoredConsent()
  if (stored) {
    client.setConsent(stored)
  }
  return client
}

export function isAnalyticsConfigured(): boolean {
  return Boolean(MEASUREMENT_ID)
}

export function applyConsent(consent: AnalyticsConsent): void {
  persistConsent(consent)
  getAnalytics().setConsent(consent)
}
