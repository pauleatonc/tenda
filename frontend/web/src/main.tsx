import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import {
  AnalyticsConsentBanner,
  AnalyticsRouteListener,
  getAnalytics,
} from './analytics'
import './analytics/analytics.css'
import './app/app-shell.css'
import './components/ui.css'
import './index.css'
import App from './App.tsx'

// Initialize GA4 client early (no-op when VITE_GA_MEASUREMENT_ID is unset).
getAnalytics()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AnalyticsRouteListener />
        <App />
        <AnalyticsConsentBanner />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
