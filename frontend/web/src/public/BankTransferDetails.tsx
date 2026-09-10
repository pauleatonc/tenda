import { useState } from 'react'

import type { PublicBankDetails } from '@tenda/api-client'

const ROWS: Array<{ key: keyof PublicBankDetails; label: string }> = [
  { key: 'bankName', label: 'Banco' },
  { key: 'accountTypeLabel', label: 'Tipo de cuenta' },
  { key: 'accountNumber', label: 'Número de cuenta' },
  { key: 'taxId', label: 'RUT' },
  { key: 'confirmationEmail', label: 'Correo de confirmación' },
]

function allDetailsText(details: PublicBankDetails): string {
  return ROWS.map((row) => `${row.label}: ${details[row.key]}`).join('\n')
}

export function BankTransferDetails({
  details,
  instructions,
  compact = false,
}: {
  details?: PublicBankDetails | null
  instructions?: string
  compact?: boolean
}) {
  const [copied, setCopied] = useState('')

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(label)
    window.setTimeout(() => {
      setCopied((current) => (current === label ? '' : current))
    }, 1800)
  }

  if (!details) {
    return (
      <div className={`bank-instructions${compact ? ' bank-instructions--compact' : ''}`}>
        <h2>Datos para transferir</h2>
        <p>{instructions || 'Solicita los datos al vendedor.'}</p>
      </div>
    )
  }

  return (
    <div className={`bank-instructions bank-instructions--structured${compact ? ' bank-instructions--compact' : ''}`}>
      <div className="bank-instructions__intro">
        <h2>Datos para transferir</h2>
        <p>Copia cada dato o todos juntos. Transfiere el monto exacto a esta cuenta.</p>
      </div>
      <dl className="bank-details-list">
        {ROWS.map((row) => (
          <div key={row.key} className="bank-details-list__row">
            <dt>{row.label}</dt>
            <dd>
              <span>{details[row.key]}</span>
              <button
                className="bank-details-copy"
                type="button"
                onClick={() => void copy(row.label, details[row.key])}
              >
                {copied === row.label ? 'Copiado' : 'Copiar'}
              </button>
            </dd>
          </div>
        ))}
      </dl>
      <button
        className="button button--secondary button--wide"
        type="button"
        onClick={() => void copy('todos', allDetailsText(details))}
      >
        {copied === 'todos' ? 'Datos copiados' : 'Copiar todos los datos'}
      </button>
    </div>
  )
}
