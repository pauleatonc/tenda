import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback': () => void
          theme: 'light'
        },
      ) => string
      remove: (widgetId: string) => void
    }
  }
}

export function turnstileSiteKey() {
  return (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? ''
}

export function TurnstileField({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const siteKey = turnstileSiteKey()

  useEffect(() => {
    if (!siteKey) {
      onToken('local-development')
      return
    }
    let widgetId = ''
    const render = () => {
      if (!container.current || !window.turnstile) return
      widgetId = window.turnstile.render(container.current, {
        sitekey: siteKey,
        callback: onToken,
        'expired-callback': () => onToken(''),
        theme: 'light',
      })
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-tenda-turnstile]',
    )
    if (window.turnstile) {
      render()
    } else if (existing) {
      existing.addEventListener('load', render, { once: true })
    } else {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.dataset.tendaTurnstile = 'true'
      script.addEventListener('load', render, { once: true })
      document.head.appendChild(script)
    }
    return () => {
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
      existing?.removeEventListener('load', render)
    }
  }, [onToken, siteKey])

  if (!siteKey) return null
  return <div className="turnstile-slot" ref={container} aria-label="Validación anti-bot" />
}
