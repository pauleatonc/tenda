import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useRef } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'

import type { ViewerPayload } from '../auth/api'
import { EmptyState, StatusChip } from '../components/ui'
import { TendaApiError, newIdempotencyKey } from '../lib/http'
import {
  fetchReconciliationIssues,
  retryReconciliation,
  salesKeys,
  type ReconciliationIssue,
} from './api'
import { formatClp, formatDate, statusTone } from './model'

const issueLabels: Record<string, string> = {
  payment_without_order: 'Pago sin pedido',
  paid_without_stock_exit: 'Pago sin salida de stock',
  pending_webhook: 'Webhook pendiente',
  fee_mismatch: 'Diferencia de comisión',
}

const statusLabels: Record<string, string> = {
  open: 'Abierta',
  retrying: 'Reintentando',
  resolved: 'Resuelta',
  escalated: 'Escalada',
  failed: 'Reintento fallido',
}

export function ReconciliationsPage() {
  const viewer = useOutletContext<ViewerPayload>()
  const allowed = ['owner', 'support_admin'].includes(viewer.membership.role)
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const retryKeys = useRef(new Map<string, string>())
  const status = params.get('estado') ?? 'open'
  const cursor = params.get('cursor')
  const variables = { status: status || null, first: 25, after: cursor }

  const issues = useQuery({
    queryKey: salesKeys.reconciliation(variables),
    queryFn: () => fetchReconciliationIssues(variables),
    enabled: allowed,
    placeholderData: keepPreviousData,
  })

  const retry = useMutation({
    mutationFn: (issue: ReconciliationIssue) => {
      const idempotencyKey = retryKeys.current.get(issue.id) ?? newIdempotencyKey()
      retryKeys.current.set(issue.id, idempotencyKey)
      return retryReconciliation({
        issueId: issue.id,
        idempotencyKey,
      })
    },
    onSuccess: (_result, issue) => {
      retryKeys.current.delete(issue.id)
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  if (!allowed) {
    return (
      <EmptyState
        title="No tienes acceso a reconciliaciones"
        description="Esta cola interna está disponible para Owner y soporte autorizado."
        action={
          <Link className="button button--secondary" to="/app/ventas">
            Volver a ventas
          </Link>
        }
      />
    )
  }

  return (
    <>
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Cola interna</p>
          <h1>Reconciliaciones</h1>
          <p>
            Pagos y movimientos que no deben ocultarse como exitosos hasta quedar
            consistentes.
          </p>
        </div>
        <Link className="button button--secondary" to="/app/ventas">
          Volver a ventas
        </Link>
      </header>

      <div className="reconciliation-toolbar">
        <label>
          <span>Estado</span>
          <select
            value={status}
            onChange={(event) => {
              const next = new URLSearchParams(params)
              if (event.target.value) next.set('estado', event.target.value)
              else next.delete('estado')
              next.delete('cursor')
              setParams(next, { replace: true })
            }}
          >
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {issues.isPending ? (
        <div className="table-skeleton" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando incidencias…</span>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} />
          ))}
        </div>
      ) : null}

      {issues.isError ? (
        <div className="form-message form-message--error" role="alert">
          <strong>No pudimos cargar la cola</strong>
          <span>
            {issues.error instanceof TendaApiError
              ? issues.error.message
              : 'Revisa tu conexión e inténtalo nuevamente.'}
          </span>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void issues.refetch()}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {retry.isError ? (
        <div className="form-message form-message--error" role="alert">
          <strong>El reintento no resolvió la incidencia</strong>
          <span>
            {retry.error instanceof TendaApiError
              ? retry.error.message
              : 'La incidencia permanece visible para revisión.'}
          </span>
        </div>
      ) : null}

      {!issues.isPending && !issues.isError && issues.data?.nodes.length === 0 ? (
        <EmptyState
          title={status === 'open' ? 'No hay incidencias abiertas' : 'Sin resultados'}
          description={
            status === 'open'
              ? 'Los pagos y movimientos conocidos están conciliados.'
              : 'No hay incidencias con el estado seleccionado.'
          }
        />
      ) : null}

      {issues.data?.nodes.length ? (
        <div className="reconciliation-list">
          {issues.data.nodes.map((issue: ReconciliationIssue) => (
            <article key={issue.id}>
              <header>
                <div>
                  <h2>{issueLabels[issue.kind] ?? issue.kind}</h2>
                  <p>{issue.message}</p>
                </div>
                <StatusChip
                  status={statusTone(issue.status)}
                  label={statusLabels[issue.status] ?? issue.status}
                />
              </header>
              <dl>
                <div>
                  <dt>Venta</dt>
                  <dd>
                    {issue.orderId ? (
                      <Link to={`/app/ventas/${issue.orderId}`}>
                        {issue.orderNumber || 'Abrir venta'}
                      </Link>
                    ) : (
                      'Sin pedido asociado'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Referencia proveedor</dt>
                  <dd>{issue.providerReference || '—'}</dd>
                </div>
                <div>
                  <dt>Esperado</dt>
                  <dd>{formatClp(issue.expectedAmount)}</dd>
                </div>
                <div>
                  <dt>Reportado</dt>
                  <dd>{formatClp(issue.actualAmount)}</dd>
                </div>
                <div>
                  <dt>Diferencia fee</dt>
                  <dd>{formatClp(issue.feeDifference)}</dd>
                </div>
                <div>
                  <dt>Intentos</dt>
                  <dd>{issue.attempts}</dd>
                </div>
                <div>
                  <dt>Último intento</dt>
                  <dd>{formatDate(issue.lastAttemptAt)}</dd>
                </div>
                <div>
                  <dt>Creada</dt>
                  <dd>{formatDate(issue.createdAt)}</dd>
                </div>
              </dl>
              {issue.canRetry ? (
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate(issue)}
                >
                  {retry.isPending && retry.variables?.id === issue.id
                    ? 'Reintentando…'
                    : 'Reintentar conciliación'}
                </button>
              ) : (
                <p className="reconciliation-list__escalated">
                  Requiere revisión manual; el reintento automático no está permitido.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : null}

      {issues.data?.pageInfo.hasNextPage ? (
        <div className="table-pagination">
          <button
            className="button button--secondary"
            type="button"
            disabled={issues.isFetching}
            onClick={() => {
              const next = new URLSearchParams(params)
              next.set('cursor', issues.data.pageInfo.endCursor)
              setParams(next)
            }}
          >
            {issues.isFetching ? 'Cargando…' : 'Ver más incidencias'}
          </button>
        </div>
      ) : null}
    </>
  )
}
