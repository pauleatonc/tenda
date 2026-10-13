import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { applyConsent, getStoredConsent, isAnalyticsConfigured } from './client'

export function AnalyticsConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isAnalyticsConfigured()) return
    if (getStoredConsent() !== null) return
    setVisible(true)
  }, [])

  if (!visible || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="analytics-consent"
      role="dialog"
      aria-modal="false"
      aria-label="Preferencias de analítica de Tenda"
      data-tenda-analytics-consent="1"
    >
      <p>
        Usamos Google Analytics para entender cómo se usa Tenda y mejorar el producto. No
        enviamos datos personales como RUT, correo o números de cuenta.
      </p>
      <div className="analytics-consent__actions">
        <button
          type="button"
          className="button button--ghost"
          data-tenda-analytics-choice="deny"
          onClick={() => {
            applyConsent({ analytics: false, adStorage: false })
            setVisible(false)
          }}
        >
          Continuar sin analítica
        </button>
        <button
          type="button"
          className="button button--primary"
          data-tenda-analytics-choice="allow"
          onClick={() => {
            applyConsent({ analytics: true, adStorage: false })
            setVisible(false)
          }}
        >
          Permitir analítica
        </button>
      </div>
    </div>,
    document.body,
  )
}
