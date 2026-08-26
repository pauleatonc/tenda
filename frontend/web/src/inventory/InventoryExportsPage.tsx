import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { TendaApiError, newIdempotencyKey } from '../lib/http'
import {
  fetchInventoryExports,
  inventoryKeys,
  retryInventoryExport,
  startInventoryExport,
} from './api'
import { formatDate, formatQuantity } from './format'

const activeStatuses = new Set(['queued', 'processing'])
const statusLabels: Record<string, string> = {
  queued: 'En cola',
  processing: 'Generando archivo',
  succeeded: 'Disponible',
  failed: 'Fallida',
}

function readList(params: URLSearchParams, key: string): string[] {
  const value = params.get(key)
  return value ? value.split(',').filter(Boolean) : []
}

export function InventoryExportsPage() {
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const [pollDelay, setPollDelay] = useState(1_000)
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const search = params.get('q') ?? ''
  const stockStates = readList(params, 'stock')
  const catalogStatuses = readList(params, 'estado')

  const exportsQuery = useQuery({
    queryKey: inventoryKeys.exports(),
    queryFn: fetchInventoryExports,
    refetchInterval: (query) =>
      query.state.data?.some((job) => activeStatuses.has(job.status))
        ? pollDelay
        : false,
  })

  useEffect(() => {
    if (exportsQuery.data?.some((job) => activeStatuses.has(job.status))) {
      setPollDelay((current) => Math.min(Math.round(current * 1.6), 8_000))
    } else {
      setPollDelay(1_000)
    }
  }, [exportsQuery.data])

  const start = useMutation({
    mutationFn: (fileFormat: 'csv' | 'xlsx') =>
      startInventoryExport({
        fileFormat,
        filter: {
          search: search || null,
          stockStates: stockStates.length ? stockStates : null,
          catalogStatuses: catalogStatuses.length ? catalogStatuses : null,
          includeArchived: catalogStatuses.includes('archived'),
        },
        idempotencyKey,
      }),
    onSuccess: (created) => {
      queryClient.setQueryData(inventoryKeys.exports(), (current: unknown) =>
        Array.isArray(current) ? [created, ...current] : [created],
      )
      setIdempotencyKey(newIdempotencyKey())
      setPollDelay(1_000)
    },
  })

  const retry = useMutation({
    mutationFn: retryInventoryExport,
    onSuccess: () => {
      setPollDelay(1_000)
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.exports() })
    },
  })

  return (
    <>
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Inventario</p>
          <h1>Exportaciones</h1>
          <p>Genera archivos privados con los filtros actuales y descárgalos por 24 horas.</p>
        </div>
        <Link className="button button--secondary" to="/app/inventario">
          Volver
        </Link>
      </header>

      <section className="wizard-card">
        <h2>Nueva exportación</h2>
        <dl className="export-filter-summary">
          <div>
            <dt>Búsqueda</dt>
            <dd>{search || 'Todos los productos'}</dd>
          </div>
          <div>
            <dt>Stock</dt>
            <dd>{stockStates.join(', ') || 'Todos'}</dd>
          </div>
          <div>
            <dt>Catálogo</dt>
            <dd>{catalogStatuses.join(', ') || 'Activos y no archivados'}</dd>
          </div>
        </dl>
        {start.error ? (
          <div className="form-message form-message--error" role="alert">
            {start.error instanceof TendaApiError
              ? start.error.message
              : 'No pudimos iniciar la exportación.'}
          </div>
        ) : null}
        <div className="page-heading__actions">
          <button
            className="button button--primary"
            type="button"
            disabled={start.isPending}
            onClick={() => start.mutate('csv')}
          >
            Exportar CSV
          </button>
          <button
            className="button button--secondary"
            type="button"
            disabled={start.isPending}
            onClick={() => start.mutate('xlsx')}
          >
            Exportar XLSX
          </button>
        </div>
      </section>

      <section className="job-history" aria-live="polite">
        <h2>Historial de exportaciones</h2>
        {exportsQuery.isPending ? <p>Cargando exportaciones…</p> : null}
        {exportsQuery.isError ? (
          <div className="form-message form-message--error" role="alert">
            <span>No pudimos cargar el historial.</span>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => void exportsQuery.refetch()}
            >
              Reintentar
            </button>
          </div>
        ) : null}
        {exportsQuery.data?.length ? (
          <ul>
            {exportsQuery.data.map((job) => (
              <li key={job.id} className="export-job">
                <div>
                  <strong>{job.fileFormat.toUpperCase()}</strong>
                  <span>{statusLabels[job.status] ?? job.status}</span>
                  <time>{formatDate(job.createdAt)}</time>
                </div>
                {activeStatuses.has(job.status) ? (
                  <div className="upload-progress">
                    <progress max={100} value={job.progress} />
                    <span>{job.progress}%</span>
                  </div>
                ) : null}
                {job.status === 'succeeded' ? (
                  <div>
                    <span>{formatQuantity(job.rowCount)} productos</span>
                    {job.downloadUrl ? (
                      <a
                        className="button button--secondary"
                        href={job.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Descargar
                      </a>
                    ) : (
                      <span>Enlace expirado</span>
                    )}
                  </div>
                ) : null}
                {job.status === 'failed' ? (
                  <div>
                    <span>La tarea falló: {job.errorCode || 'UNEXPECTED_ERROR'}</span>
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate(job.id)}
                    >
                      Reintentar
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : !exportsQuery.isPending ? (
          <p>No hay exportaciones anteriores.</p>
        ) : null}
      </section>
    </>
  )
}
