import { usePathname, useSegments } from 'expo-router'
import { useEffect } from 'react'

import { getAnalytics } from '../lib/analytics'

/** Logs Firebase screen_view on expo-router path changes. */
export function AnalyticsScreenTracker() {
  const pathname = usePathname()
  const segments = useSegments()

  useEffect(() => {
    const screenName = pathname || segments.join('/') || 'unknown'
    getAnalytics().screenView(screenName)
  }, [pathname, segments])

  return null
}
