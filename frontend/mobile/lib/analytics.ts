import {
  AnalyticsEvents,
  createAnalytics,
  createFirebaseAdapter,
  createNoopAnalytics,
  type AnalyticsClient,
} from '@tenda/analytics'

export { AnalyticsEvents }
export type { AnalyticsClient }

let client: AnalyticsClient | null = null

/**
 * Firebase Analytics when native modules are present (EAS / dev client).
 * Falls back to no-op in Expo Go or when google-services files are missing.
 */
export function getAnalytics(): AnalyticsClient {
  if (client) return client
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const analyticsModule = require('@react-native-firebase/analytics') as {
      default: () => {
        logEvent: (name: string, params?: Record<string, unknown>) => Promise<void>
        logScreenView: (params: {
          screen_name: string
          screen_class?: string
        }) => Promise<void>
        setUserId: (id: string | null) => Promise<void>
        setUserProperties: (properties: Record<string, string | null>) => Promise<void>
        setAnalyticsCollectionEnabled: (enabled: boolean) => Promise<void>
      }
    }
    // Ensure app module is loaded so Analytics can initialize.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@react-native-firebase/app')
    client = createAnalytics(createFirebaseAdapter(() => analyticsModule.default()))
  } catch {
    client = createNoopAnalytics()
  }
  return client
}

const ACTIVATION_KEY = 'tenda.analytics.activation_completed'
const FLAGS_KEY = 'tenda.analytics.activation_flags'

type ActivationFlags = {
  product: boolean
  payments: boolean
  salePublished: boolean
}

async function readFlags(): Promise<ActivationFlags> {
  try {
    const SecureStore = await import('expo-secure-store')
    const raw = await SecureStore.getItemAsync(FLAGS_KEY)
    if (!raw) return { product: false, payments: false, salePublished: false }
    const parsed = JSON.parse(raw) as Partial<ActivationFlags>
    return {
      product: Boolean(parsed.product),
      payments: Boolean(parsed.payments),
      salePublished: Boolean(parsed.salePublished),
    }
  } catch {
    return { product: false, payments: false, salePublished: false }
  }
}

export async function markActivationFlag(
  flag: keyof ActivationFlags,
): Promise<void> {
  try {
    const SecureStore = await import('expo-secure-store')
    if ((await SecureStore.getItemAsync(ACTIVATION_KEY)) === '1') return
    const flags = await readFlags()
    if (flags[flag]) return
    const next = { ...flags, [flag]: true }
    await SecureStore.setItemAsync(FLAGS_KEY, JSON.stringify(next))
    if (next.product && next.payments && next.salePublished) {
      getAnalytics().track(AnalyticsEvents.activationCompleted)
      await SecureStore.setItemAsync(ACTIVATION_KEY, '1')
    }
  } catch {
    // Secure store unavailable — skip activation tracking.
  }
}
