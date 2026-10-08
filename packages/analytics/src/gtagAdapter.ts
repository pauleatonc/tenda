import type { AnalyticsAdapter, AnalyticsConsent, AnalyticsParamBag } from './types.js'

export type GtagFunction = (
  command: string,
  targetOrAction?: string | Date | Record<string, unknown>,
  params?: Record<string, unknown>,
) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: GtagFunction
  }
}

export type GtagAdapterOptions = {
  measurementId: string
  /** When true, loads gtag.js and configures the measurement ID. */
  loadScript?: boolean
}

function ensureGtag(): GtagFunction | null {
  if (typeof window === 'undefined') return null
  if (typeof window.gtag === 'function') return window.gtag
  return null
}

/**
 * Creates a GA4 gtag adapter. Call `initGtag` once at app bootstrap before tracking.
 */
export function createGtagAdapter(options: GtagAdapterOptions): AnalyticsAdapter {
  const { measurementId } = options

  return {
    track(event, params) {
      const gtag = ensureGtag()
      if (!gtag) return
      gtag('event', event, params ?? {})
    },
    pageView(path, title) {
      const gtag = ensureGtag()
      if (!gtag) return
      gtag('event', 'page_view', {
        page_path: path,
        page_title: title ?? document.title,
        send_to: measurementId,
      })
    },
    setUserId(userId) {
      const gtag = ensureGtag()
      if (!gtag) return
      gtag('config', measurementId, {
        user_id: userId ?? undefined,
      })
    },
    setUserProperties(properties: AnalyticsParamBag) {
      const gtag = ensureGtag()
      if (!gtag) return
      gtag('set', 'user_properties', properties)
    },
    setConsent(consent: AnalyticsConsent) {
      const gtag = ensureGtag()
      if (!gtag) return
      const value = consent.analytics ? 'granted' : 'denied'
      const ad = consent.adStorage === true ? 'granted' : 'denied'
      gtag('consent', 'update', {
        analytics_storage: value,
        ad_storage: ad,
        ad_user_data: ad,
        ad_personalization: ad,
      })
    },
  }
}

/**
 * Injects gtag.js, sets default consent to denied, and configures the stream.
 * Safe to call once; no-ops without a measurement ID or when `window` is missing.
 */
export function initGtag(measurementId: string): void {
  if (
    !measurementId ||
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return
  }
  if (document.getElementById('tenda-ga4')) return

  window.dataLayer = window.dataLayer ?? []
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args)
  }

  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  })

  window.gtag('js', new Date())
  window.gtag('config', measurementId, {
    send_page_view: false,
    anonymize_ip: true,
  })

  const script = document.createElement('script')
  script.id = 'tenda-ga4'
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  document.head.appendChild(script)
}
