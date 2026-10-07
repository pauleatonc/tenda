// React Native Testing Library v14 registers its jest matchers on import.
import type { ReactNode } from 'react'

// React 19 only allows `act()` when the environment opts in explicitly.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// SecureStore and randomUUID are native modules: the tests only care that the
// screens ask for them, never about the device implementation.
jest.mock('react-native-webview', () => {
  const { View } = require('react-native') as typeof import('react-native')
  return { WebView: View }
})

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(async () => ({ type: 'cancel' })),
  maybeCompleteAuthSession: jest.fn(),
}))

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `tenda://${path}`),
}))

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => 'test-token'),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlockedThisDeviceOnly',
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}))

jest.mock('expo-image', () => {
  const { View } = require('react-native') as typeof import('react-native')
  return { Image: View }
})

jest.mock('../lib/analytics', () => ({
  AnalyticsEvents: new Proxy(
    {},
    { get: (_t, prop) => (typeof prop === 'string' ? prop : undefined) },
  ),
  getAnalytics: () => ({
    track: jest.fn(),
    screen: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
  }),
  markActivationFlag: jest.fn(async () => undefined),
}))

jest.mock('expo-crypto', () => {
  let counter = 0
  return {
    randomUUID: jest.fn(
      () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
    ),
  }
})

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  Link: ({ children }: { children: ReactNode }) => children,
}))
