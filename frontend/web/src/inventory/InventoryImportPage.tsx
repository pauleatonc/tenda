import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { UploadField } from '../components/ui'
import { TendaApiError, newIdempotencyKey } from '../lib/http'
import {
  confirmInventoryImport,
  fetchInventoryImport,
  fetchInventoryImports,
  fetchInventorySchema,
  inventoryKeys,
  previewInventoryImport,
  retryInventoryImport,
  startInventoryImport,
  uploadPrivateFile,
  type InventoryImportJob,
} from './api'
import { formatDate, formatQuantity } from './format'

const POLLING_STATUSES = new Set(['analysing', 'queued', 'processing'])
const TERMINAL_STATUSES = new Set(['succeeded', 'completed_with_errors', 'failed'])

const statusLabels: Record<string, string> = {
  analysing: 'Analizando archivo',
  awaiting_mapping: 'Esperando mapeo',
  queued: 'En cola',
  processing: 'Importando',
  succeeded: 'Completada',
  completed_with_errors: 'Completada con errores',
  failed: 'Fallida',
}

function guessHeader(headers: string[], candidates: string[]): string {
  const wanted = new Set(
    candidates.map((candidate) => candidate.trim().toLocaleLowerCase('es-CL')),
  )
  return (
    headers.find((header) => wanted.has(header.trim().toLocaleLowerCase('es-CL'))) ?? ''
  )
}

function defaultMapping(
  job: InventoryImportJob,
  fields: { key: string; label: string }[],
): Record<string, string> {
  const mapping: Record<string, string> = {}
  const guesses: Record<string, string[]> = {
    name: ['nombre', 'producto', 'name'],
    initialQuantity: ['cantidad', 'stock', 'stock inicial', 'initial quantity'],
    catalogStatus: ['estado', 'estado catálogo', 'catalog status'],
    purchasePrice: ['precio compra', 'costo', 'purchase price'],
    salePrice: ['precio venta', 'precio', 'sale price'],
  }
  for (const [destination, candidates] of Object.entries(guesses)) {
    const source = guessHeader(job.headers, candidates)
    if (source) mapping[destination] = source
  }
  for (const field of fields) {
    const source = guessHeader(job.headers, [field.label.toLowerCase(), field.key.toLowerCase()])
    if (source) mapping[`extraAttributes.${field.key}`] = source
  }
  return mapping
}

export function InventoryImportPage() {
  const queryClient = useQueryClient()
  const [jobId, setJobId] = useState('')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [mappingReadyForJob, setMappingReadyForJob] = useState('')
  const [previewed, setPreviewed] = useState(false)
  const [pollDelay, setPollDelay] = useState(1_000)
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)

  const schema = useQuery({
    queryKey: inventoryKeys.schema(false),
    queryFn: () => fetchInventorySchema(false),
  })
  const history = useQuery({
    queryKey: inventoryKeys.imports(),
    queryFn: fetchInventoryImports,
  })
  const job = useQuery({
    queryKey: inventoryKeys.import(jobId),
    queryFn: () => fetchInventoryImport(jobId),
    enabled: Boolean(jobId),
    refetchInterval: (query) =>
      query.state.data && POLLING_STATUSES.has(query.state.data.status) ? pollDelay : false,
  })

  useEffect(() => {
    if (!job.data || !POLLING_STATUSES.has(job.data.status)) {
      setPollDelay(1_000)
      return
    }
    setPollDelay((current) => Math.min(Math.round(current * 1.6), 8_000))
  }, [job.data])

  useEffect(() => {
    if (job.data && TERMINAL_STATUSES.has(job.data.status)) {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.imports() })
    }
  }, [job.data, queryClient])

  const activeFields = useMemo(
    () => (schema.data?.fields ?? []).filter((field) => field.isActive),
    [schema.data],
  )

  useEffect(() => {
    if (
      !job.data ||
      job.data.status !== 'awaiting_mapping' ||
      mappingReadyForJob === job.data.id
    ) {
      return
    }
    setMapping(defaultMapping(job.data, activeFields))
    setMappingReadyForJob(job.data.id)
    setPreviewed(false)
  }, [activeFields, job.data, mappingReadyForJob])

  const upload = useMutation({
    mutationFn: async (file: File) => {
      setUploadProgress(0)
      const assetId = await uploadPrivateFile(file, 'import_file', setUploadProgress)
      return startInventoryImport(assetId)
    },
    onSuccess: (created) => {
      setJobId(created.id)
      setUploadProgress(null)
      setPollDelay(1_000)
      queryClient.setQueryData(inventoryKeys.import(created.id), created)
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.imports() })
    },
    onError: () => setUploadProgress(null),
  })

  const preview = useMutation({
    mutationFn: () => previewInventoryImport(jobId, mapping),
    onSuccess: (updated) => {
      queryClient.setQueryData(inventoryKeys.import(jobId), updated)
      setPreviewed(true)
    },
  })

  const confirm = useMutation({
    mutationFn: () => confirmInventoryImport(jobId, idempotencyKey),
    onSuccess: (updated) => {
      queryClient.setQueryData(inventoryKeys.import(jobId), updated)
      setPollDelay(1_000)
    },
  })

  const retry = useMutation({
    mutationFn: () => retryInventoryImport(jobId),
    onSuccess: (updated) => {
      queryClient.setQueryData(inventoryKeys.import(jobId), updated)
      setPollDelay(1_000)
    },
  })

  const current = job.data
  const destinations = [
    { key: 'name', label: 'Nombre del producto (obligatorio)' },
    { key: 'initialQuantity', label: 'Cantidad inicial' },
    { key: 'catalogStatus', label: 'Estado de catálogo' },
    { key: 'purchasePrice', label: 'Precio de compra' },
    { key: 'salePrice', label: 'Precio de venta' },
    ...activeFields.map((field) => ({
      key: `extraAttributes.${field.key}`,
      label: field.label,
    })),
  ]
  const actionError = upload.error ?? preview.error ?? confirm.error ?? retry.error

  function reset() {
    setJobId('')
    setMapping({})
    setMappingReadyForJob('')
    setPreviewed(false)
    setIdempotencyKey(newIdempotencyKey())
  }

  return (
    <>
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Inventario</p>
          <h1>Importar productos</h1>
          <p>Sube un CSV o XLSX, revisa las columnas y confirma antes de escribir datos.</p>
        </div>
        <Link className="button button--secondary" to="/app/inventario">
          Volver
        </Link>
      </header>

      {actionError ? (
        <div className="form-message form-message--error" role="alert">
          <strong>No pudimos completar el paso</strong>
          <span>
            {actionError instanceof TendaApiError
              ? actionError.message
              : 'Revisa el archivo e inténtalo nuevamente.'}
          </span>
        </div>
      ) : null}

      {!jobId ? (
        <section className="wizard-card">
          <span className="wizard-card__step">Paso 1 de 4</span>
          <h2>Selecciona el archivo</h2>
          <p>Máximo 25 MB. La primera fila debe contener encabezados únicos.</p>
          <UploadField
            label="Archivo de inventario"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={upload.isPending}
            onSelect={(file) => upload.mutate(file)}
          />
          {uploadProgress !== null ? (
            <div className="upload-progress" aria-live="polite">
              <progress max={100} value={uploadProgress} />
              <span>Cargando archivo: {uploadProgress}%</span>
            </div>
          ) : null}
        </section>
      ) : null}

      {jobId && (!current || current.status === 'analysing') ? (
        <section className="wizard-card" aria-busy="true">
          <span className="wizard-card__step">Paso 2 de 4</span>
          <h2>Analizando archivo</h2>
          <p aria-live="polite">
            Detectamos encabezados y filas. Puedes dejar esta vista abierta.
          </p>
          <progress max={100} value={current?.progress ?? 0} />
        </section>
      ) : null}

      {current?.status === 'awaiting_mapping' ? (
        <section className="wizard-card">
          <span className="wizard-card__step">Paso 2 de 4</span>
          <h2>Asocia las columnas</h2>
          <p>
            Archivo: <strong>{current.sourceFileName}</strong> ·{' '}
            {formatQuantity(current.totalRows)} filas
          </p>
          <div className="mapping-grid">
            {destinations.map((destination) => (
              <label key={destination.key}>
                <span>{destination.label}</span>
                <select
                  value={mapping[destination.key] ?? ''}
                  onChange={(event) => {
                    const source = event.target.value
                    setMapping((currentMapping) => {
                      const next = { ...currentMapping }
                      if (source) next[destination.key] = source
                      else delete next[destination.key]
                      return next
                    })
                    setPreviewed(false)
                  }}
                >
                  <option value="">No importar</option>
                  {current.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            className="button button--primary"
            type="button"
            disabled={!mapping.name || preview.isPending}
            onClick={() => preview.mutate()}
          >
            {preview.isPending ? 'Validando…' : 'Previsualizar y validar'}
          </button>

          {current.previewRows.length ? (
            <div className="import-preview">
              <h3>Vista previa de las primeras filas</h3>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      {current.headers.map((header) => (
                        <th key={header} scope="col">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {current.previewRows.slice(0, 5).map((row, index) => (
                      <tr key={index}>
                        {current.headers.map((header) => (
                          <td key={header}>{String(row[header] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {previewed ? (
            <div className="wizard-review" aria-live="polite">
              <span className="wizard-card__step">Paso 3 de 4</span>
              <h3>Resultado de la previsualización</h3>
              {current.rowErrors.length ? (
                <>
                  <p>
                    Encontramos {formatQuantity(current.rowErrors.length)} errores en la
                    muestra. Las filas válidas sí podrán importarse.
                  </p>
                  <ul className="row-error-list">
                    {current.rowErrors.map((rowError) => (
                      <li key={`${rowError.row}-${rowError.code}`}>
                        Fila {rowError.row}: {rowError.message}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>La muestra no presenta errores. Confirma para procesar todo el archivo.</p>
              )}
              <button
                className="button button--primary"
                type="button"
                disabled={confirm.isPending}
                onClick={() => confirm.mutate()}
              >
                {confirm.isPending ? 'Confirmando…' : 'Confirmar importación'}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {current && ['queued', 'processing'].includes(current.status) ? (
        <section className="wizard-card" aria-busy="true">
          <span className="wizard-card__step">Paso 4 de 4</span>
          <h2>{statusLabels[current.status]}</h2>
          <progress max={100} value={current.progress} />
          <p aria-live="polite">
            {current.progress}% · {formatQuantity(current.processedRows)} de{' '}
            {formatQuantity(current.totalRows)} filas procesadas
          </p>
        </section>
      ) : null}

      {current && TERMINAL_STATUSES.has(current.status) ? (
        <section className="wizard-card">
          <span className="wizard-card__step">Resultado</span>
          <h2>{statusLabels[current.status]}</h2>
          {current.status === 'failed' ? (
            <p>La tarea terminó con el código {current.errorCode || 'UNEXPECTED_ERROR'}.</p>
          ) : (
            <p>
              {formatQuantity(current.createdCount)} filas creadas ·{' '}
              {formatQuantity(current.errorCount)} con error
            </p>
          )}
          <div className="page-heading__actions">
            {current.reportUrl ? (
              <a
                className="button button--secondary"
                href={current.reportUrl}
                target="_blank"
                rel="noreferrer"
              >
                Descargar reporte
              </a>
            ) : null}
            {current.status !== 'succeeded' ? (
              <button
                className="button button--secondary"
                type="button"
                disabled={retry.isPending}
                onClick={() => retry.mutate()}
              >
                Reintentar tarea
              </button>
            ) : null}
            <button className="button button--primary" type="button" onClick={reset}>
              Importar otro archivo
            </button>
          </div>
        </section>
      ) : null}

      <section className="job-history">
        <h2>Importaciones recientes</h2>
        {history.data?.length ? (
          <ul>
            {history.data.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => setJobId(item.id)}>
                  <strong>{item.sourceFileName}</strong>
                  <span>{statusLabels[item.status] ?? item.status}</span>
                  <time>{formatDate(item.createdAt)}</time>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No hay importaciones anteriores.</p>
        )}
      </section>
    </>
  )
}
