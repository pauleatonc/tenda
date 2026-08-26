// React Native Testing Library v14 registers its jest matchers on import.
import type { ReactNode } from 'react'

// React 19 only allows `act()` when the environment opts in explicitly.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// SecureStore and randomUUID are native modules: the tests only care that the
// screens ask for them, never about the device implementation.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => 'test-token'),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlockedThisDeviceOnly',
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
