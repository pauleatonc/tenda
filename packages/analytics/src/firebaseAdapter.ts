import type { AnalyticsAdapter, AnalyticsConsent, AnalyticsParamBag } from './types.js'

/**
 * Minimal surface we need from `@react-native-firebase/analytics`.
 * Kept loose so the package has no native dependency.
 */
export type FirebaseAnalyticsModule = {
  logEvent: (name: string, params?: Record<string, unknown>) => Promise<void>
  logScreenView: (params: { screen_name: string; screen_class?: string }) => Promise<void>
  setUserId: (id: string | null) => Promise<void>
  setUserProperties: (properties: Record<string, string | null>) => Promise<void>
  setAnalyticsCollectionEnabled: (enabled: boolean) => Promise<void>
}

export type FirebaseAnalyticsFactory = () => FirebaseAnalyticsModule

function stringifyProps(properties: AnalyticsParamBag): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(properties)) {
    out[key] = String(value)
  }
  return out
}

/**
 * Firebase Analytics adapter for React Native (GA4 app streams).
 * Pass a factory that returns `analytics()` from `@react-native-firebase/analytics`.
 * When the factory throws (e.g. Expo Go without native modules), tracking becomes a no-op.
 */
export function createFirebaseAdapter(
  getAnalytics: FirebaseAnalyticsFactory,
): AnalyticsAdapter {
  const safe = (fn: (analytics: FirebaseAnalyticsModule) => void | Promise<void>) => {
    try {
      const analytics = getAnalytics()
      void Promise.resolve(fn(analytics)).catch(() => {})
    } catch {
      // Native module unavailable (Expo Go / missing google-services).
    }
  }

  return {
    track(event, params) {
      safe((analytics) => analytics.logEvent(event, params ?? {}))
    },
    screenView(screenName, params) {
      safe((analytics) =>
        analytics.logScreenView({
          screen_name: screenName,
          screen_class:
            typeof params?.screen_class === 'string' ? params.screen_class : screenName,
        }),
      )
    },
    setUserId(userId) {
      safe((analytics) => analytics.setUserId(userId))
    },
    setUserProperties(properties: AnalyticsParamBag) {
      safe((analytics) => analytics.setUserProperties(stringifyProps(properties)))
    },
    setConsent(consent: AnalyticsConsent) {
      safe((analytics) => analytics.setAnalyticsCollectionEnabled(consent.analytics))
    },
  }
}
