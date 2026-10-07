import { useState } from 'react'
import {
  applyConsent,
  getStoredConsent,
  isAnalyticsConfigured,
} from './client'

export function AnalyticsConsentBanner() {
  const [visible, setVisible] = useState(() => {
    if (!isAnalyticsConfigured()) return false
    return getStoredConsent() === null
  })

  if (!visible) return null

  return (
    <div className="analytics-consent" role="dialog" aria-label="Preferencias de analítica">
      <p>
        Usamos Google Analytics para entender cómo se usa Tenda y mejorar el producto. No
        enviamos datos personales como RUT, correo o números de cuenta.
      </p>
      <div className="analytics-consent__actions">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => {
            applyConsent({ analytics: false, adStorage: false })
            setVisible(false)
          }}
        >
          Rechazar
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            applyConsent({ analytics: true, adStorage: false })
            setVisible(false)
          }}
        >
          Aceptar
        </button>
      </div>
    </div>
  )
}
