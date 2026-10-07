import type {
  AnalyticsAdapter,
  AnalyticsClient,
  AnalyticsConsent,
  AnalyticsParamBag,
  AnalyticsUserProperties,
} from './types.js'

function toParamBag(
  params: Record<string, string | number | boolean | undefined> | undefined,
): AnalyticsParamBag | undefined {
  if (!params) return undefined
  const out: AnalyticsParamBag = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function createAnalytics(adapter: AnalyticsAdapter): AnalyticsClient {
  return {
    track(event, params) {
      adapter.track(
        event,
        toParamBag(params as Record<string, string | number | boolean | undefined> | undefined),
      )
    },
    pageView(path, title) {
      adapter.pageView?.(path, title)
    },
    screenView(screenName, params) {
      adapter.screenView?.(screenName, params)
    },
    setUser(userId) {
      adapter.setUserId?.(userId)
    },
    setUserProperties(properties: AnalyticsUserProperties) {
      adapter.setUserProperties?.(toParamBag(properties) ?? {})
    },
    setConsent(consent: AnalyticsConsent) {
      adapter.setConsent?.(consent)
    },
  }
}

export function createNoopAnalytics(): AnalyticsClient {
  return createAnalytics({
    track() {},
  })
}
