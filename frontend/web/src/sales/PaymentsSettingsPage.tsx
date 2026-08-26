import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext, useSearchParams } from 'react-router-dom'

import type { ViewerPayload } from '../auth/api'
import { EmptyState, StatusChip } from '../components/ui'
import { TendaApiError } from '../lib/http'
import {
  disconnectMercadoPagoConnection,
  fetchPaymentConnection,
  salesKeys,
  startMercadoPagoConnection,
} from './api'
import { formatClp, formatDate, statusTone } from './model'

const connectionLabels: Record<string, string> = {
  active: 'Conectada',
  connected: 'Conectada',
  pending: 'Conexión pendiente',
  expired: 'Autorización vencida',
  revoked: 'Acceso revocado',
  disconnected: 'Desconectada',
  error: 'Requiere atención',
}

function formatApiDate(value: unknown): string {
  return formatDate(value ? String(value) : null)
}

export function PaymentsSettingsPage() {
  const viewer = useOutletContext<ViewerPayload>()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const canManage =
    viewer.membership.role === 'owner' ||
    viewer.membership.permissions.manageSensitiveConfiguration

  const connection = useQuery({
    queryKey: salesKeys.paymentConnection(),
    queryFn: fetchPaymentConnection,
    enabled: canManage,
  })

  const connect = useMutation({
    mutationFn: startMercadoPagoConnection,
    onSuccess: (result) => window.location.assign(result.authorizationUrl),
  })

  const disconnect = useMutation({
    mutationFn: disconnectMercadoPagoConnection,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.paymentConnection() })
    },
  })

  if (!canManage) {
    return (
      <>
        <header className="page-heading">
          <div>
            <p className="eyebrow">Permiso requerido</p>
            <h1>Configuración de pagos</h1>
          </div>
        </header>
        <EmptyState
          title="No puedes administrar conexiones de pago"
          description="Esta configuración está disponible para Owner o para una membresía con permiso de configuración sensible."
        />
      </>
    )
  }

  const data = connection.data
  const account = data?.sellerPaymentConnection
  const configuration = data?.paymentCommissionConfiguration
  const active = account && ['active', 'connected'].includes(account.status)
  const callbackStatus = params.get('paymentConnection')

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Configuración segura</p>
          <h1>Pagos</h1>
          <p>
            Conecta Mercado Pago mediante OAuth. Tenda nunca solicita ni almacena tus
            credenciales de acceso.
          </p>
        </div>
      </header>

      {params.get('connected') === '1' || callbackStatus === 'connected' ? (
        <div className="form-message form-message--success" role="status">
          <strong>Mercado Pago volvió a Tenda</strong>
          <span>Estamos verificando el estado de la autorización.</span>
        </div>
      ) : null}
      {callbackStatus === 'error' ? (
        <div className="form-message form-message--error" role="alert">
          <strong>Mercado Pago no completó la conexión</strong>
          <span>
            Vuelve a intentarlo. Código: {params.get('code') || 'no informado'}.
          </span>
        </div>
      ) : null}

      {connection.isPending ? (
        <div className="settings-skeleton" aria-busy="true">
          <span className="sr-only">Consultando conexión de pago…</span>
        </div>
      ) : null}

      {connection.isError ? (
        <div className="form-message form-message--error" role="alert">
          <strong>No pudimos consultar la conexión</strong>
          <span>
            {connection.error instanceof TendaApiError
              ? connection.error.message
              : 'Revisa tu conexión e inténtalo nuevamente.'}
          </span>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void connection.refetch()}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {!connection.isPending && !connection.isError ? (
        <div className="payment-settings-grid">
          <section className="payment-provider-card">
            <header>
              <div>
                <span>Proveedor</span>
                <h2>Mercado Pago</h2>
              </div>
              <StatusChip
                status={active ? 'success' : statusTone(account?.status ?? 'pending')}
                label={
                  account
                    ? (connectionLabels[account.status] ?? account.status)
                    : 'Sin conectar'
                }
              />
            </header>

            {account ? (
              <dl>
                <div>
                  <dt>Cuenta del proveedor</dt>
                  <dd>{account.providerAccountId || 'No informada'}</dd>
                </div>
                <div>
                  <dt>Conectada desde</dt>
                  <dd>{formatApiDate(account.connectedAt)}</dd>
                </div>
                <div>
                  <dt>Vigencia de autorización</dt>
                  <dd>{formatApiDate(account.tokenExpiresAt)}</dd>
                </div>
                <div>
                  <dt>Última desconexión</dt>
                  <dd>{formatApiDate(account.disconnectedAt)}</dd>
                </div>
                <div>
                  <dt>Permisos autorizados</dt>
                  <dd>
                    {account.scopes.length ? (
                      <ul className="scope-list">
                        {account.scopes.map((scope) => (
                          <li key={scope}>{scope}</li>
                        ))}
                      </ul>
                    ) : (
                      'Sin permisos informados'
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <p>
                Conectar habilita Mercado Pago en nuevas ventas. La autorización ocurre
                completamente en el sitio del proveedor.
              </p>
            )}

            {Boolean(connect.error || disconnect.error) && (
              <div className="form-message form-message--error" role="alert">
                <span>
                  {(connect.error ?? disconnect.error) instanceof TendaApiError
                    ? (connect.error ?? disconnect.error)?.message
                    : 'No pudimos completar la acción.'}
                </span>
              </div>
            )}

            <div className="payment-provider-card__actions">
              {!active ? (
                <button
                  className="button button--primary"
                  type="button"
                  disabled={connect.isPending}
                  onClick={() => connect.mutate()}
                >
                  {connect.isPending ? 'Preparando conexión…' : 'Conectar Mercado Pago'}
                </button>
              ) : (
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={disconnect.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        '¿Desconectar Mercado Pago? Las ventas existentes conservarán su historial.',
                      )
                    ) {
                      disconnect.mutate()
                    }
                  }}
                >
                  {disconnect.isPending ? 'Desconectando…' : 'Desconectar'}
                </button>
              )}
              <button
                className="button button--secondary"
                type="button"
                disabled={connection.isFetching}
                onClick={() => void connection.refetch()}
              >
                {connection.isFetching ? 'Sincronizando…' : 'Sincronizar estado'}
              </button>
            </div>
          </section>

          {configuration ? (
            <aside className="payment-commission-card">
              <h2>Comisión visible al checkout</h2>
              <dl>
                <div>
                  <dt>Modo</dt>
                  <dd>{configuration.mode}</dd>
                </div>
                <div>
                  <dt>Tasa</dt>
                  <dd>{configuration.rate}%</dd>
                </div>
                <div>
                  <dt>Mínimo operacional</dt>
                  <dd>{formatClp(configuration.minimum)}</dd>
                </div>
                <div>
                  <dt>Intento sin fee</dt>
                  <dd>{configuration.zeroFeeEnabled ? 'Habilitado' : 'Deshabilitado'}</dd>
                </div>
              </dl>
              <p>
                El comprador verá cualquier cargo no nulo antes de confirmar. El retorno
                desde Mercado Pago no marca una venta como pagada: Tenda espera la
                verificación del proveedor.
              </p>
            </aside>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
