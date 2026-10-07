import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getAnalytics } from './client'

/** Sends GA4 page_view on every SPA route change. */
export function AnalyticsRouteListener() {
  const location = useLocation()

  useEffect(() => {
    const path = `${location.pathname}${location.search}`
    getAnalytics().pageView(path)
  }, [location.pathname, location.search])

  return null
}
