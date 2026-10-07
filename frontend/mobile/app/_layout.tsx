import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState } from 'react'
import { AppState, type AppStateStatus, Platform } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AnalyticsScreenTracker } from '../components/analytics-screen-tracker'
import { getAnalytics } from '../lib/analytics'

WebBrowser.maybeCompleteAuthSession()
getAnalytics()

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active')
  }
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            // Refetch stale queries only when returning to foreground (via focusManager).
            refetchOnWindowFocus: true,
          },
        },
      }),
  )

  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange)
    return () => subscription.remove()
  }, [])

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <AnalyticsScreenTracker />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#f7f5ef' },
            contentStyle: { backgroundColor: '#f7f5ef' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
