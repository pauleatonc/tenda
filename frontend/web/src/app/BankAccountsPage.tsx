import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'

import type { ViewerPayload } from '../auth/api'
import { EmptyState } from '../components/ui'
import { BankDetailsSection } from './BankDetailsSection'

export function BankAccountsPage() {
  const viewer = useOutletContext<ViewerPayload>()
  const queryClient = useQueryClient()
  const canManage =
    viewer.membership.role === 'owner' ||
    viewer.membership.permissions.manageSensitiveConfiguration
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (!canManage) {
    return (
      <EmptyState
        title="No puedes editar las cuentas bancarias"
        description="Esta sección está disponible para quien titula la tienda."
      />
    )
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Depósitos</p>
          <h1>Cuentas bancarias</h1>
          <p>Estos datos se muestran al comprador cuando paga por transferencia.</p>
        </div>
      </header>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-message form-message--error" role="alert">
          {error}
        </p>
      ) : null}
      <BankDetailsSection
        viewer={viewer}
        canManage={canManage}
        onSaved={(status) => {
          setMessage(status)
          setError('')
          void queryClient.invalidateQueries({ queryKey: ['viewer'] })
        }}
        onError={(status) => {
          setMessage('')
          setError(status)
        }}
      />
    </>
  )
}
