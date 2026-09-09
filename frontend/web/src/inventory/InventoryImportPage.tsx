import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { UploadField } from '../components/ui'
import { TendaApiError, newIdempotencyKey } from '../lib/http'
import {
  confirmInventoryImport,
  fetchInventoryImport,
  fetchInventoryImports,
  fetchInventoryImportTemplate,
  fetchInventorySchema,
  inventoryKeys,
  previewInventoryImport,
  retryInventoryImport,
  startInventoryImport,
  uploadPrivateFile,
} from './api'
import { formatDate, formatQuantity } from './format'
import {
  downloadBase64File,
  humanImportFailure,
  importColumnsForFields,
  mappingFromImportHeaders,
} from './import-template'

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

export function InventoryImportPage() {
  const queryClient = useQueryClient()
  const [jobId, setJobId] = useState('')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [mappingReadyForJob, setMappingReadyForJob] = useState('')
  const [previewedKey, setPreviewedKey] = useState('')
  const [pollDelay, setPollDelay] = useState(1_000)
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)

  const schema = useQuery({
    queryKey: inventoryKeys.schema(false),
    queryFn: () => fetchInventorySchema(false),
  })
  const template = useQuery({
    queryKey: inventoryKeys.importTemplate(),
    queryFn: fetchInventoryImportTemplate,
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
  const columns = useMemo(
    () => template.data?.columns ?? importColumnsForFields(activeFields),
    [activeFields, template.data],
  )

  const mappingKey = JSON.stringify(mapping)

  useEffect(() => {
    if (
      !job.data ||
      job.data.status !== 'awaiting_mapping' ||
      mappingReadyForJob === job.data.id
    ) {
      return
    }
    setMapping(mappingFromImportHeaders(job.data.headers, columns))
    setMappingReadyForJob(job.data.id)
    setPreviewedKey('')
  }, [columns, job.data, mappingReadyForJob])

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
    mutationFn: (nextMapping: Record<string, string>) =>
      previewInventoryImport(jobId, nextMapping),
    onSuccess: (updated, nextMapping) => {
      queryClient.setQueryData(inventoryKeys.import(jobId), updated)
      setPreviewedKey(JSON.stringify(nextMapping))
    },
  })

  useEffect(() => {
    if (!job.data || job.data.status !== 'awaiting_mapping') return
    if (mappingReadyForJob !== job.data.id || !mapping.name) return
    if (previewedKey === mappingKey || preview.isPending) return
    preview.mutate(mapping)
    // `preview` in the deps retriggers this effect on every mutation identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.data, mapping, mappingKey, mappingReadyForJob, previewedKey])

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
  const destinations = columns.map((column) => ({
    key: column.destination,
    label: column.required ? `${column.header} (obligatorio)` : column.header,
  }))
  const usedTemplateHeaders = Boolean(mapping.name)
  const previewed = previewedKey === mappingKey && Boolean(mapping.name)
  const actionError = upload.error ?? preview.error ?? confirm.error ?? retry.error

  function reset() {
    setJobId('')
    setMapping({})
    setMappingReadyForJob('')
    setPreviewedKey('')
    setIdempotencyKey(newIdempotencyKey())
  }

  return (
    <>
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Inventario</p>
          <h1>Importar productos</h1>
          <p>
            Descarga la planilla Excel con las columnas de tu inventario, complétala y
            súbela. La importación masiva solo está en la web.
          </p>
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
              ? humanImportFailure(actionError.code, actionError.message)
              : 'Revisa el archivo e inténtalo nuevamente.'}
          </span>
        </div>
      ) : null}

      {!jobId ? (
        <section className="wizard-card">
          <span className="wizard-card__step">Paso 1 de 3</span>
          <h2>Descarga la planilla y cárgala completa</h2>
          <p>
            Incluye nombre, cantidad, estado, precios y las columnas propias del
            inventario. Completa una fila por producto y no cambies los encabezados.
          </p>
          <div className="page-heading__actions">
            <button
              className="button button--primary"
              type="button"
              disabled={!template.data || template.isFetching}
              onClick={() => {
                if (!template.data) return
                downloadBase64File(
                  template.data.fileName,
                  template.data.contentType,
                  template.data.contentBase64,
                )
              }}
            >
              {template.isFetching ? 'Preparando planilla…' : 'Descargar planilla Excel'}
            </button>
            {template.isError ? (
              <button
                className="button button--secondary"
                type="button"
                onClick={() => void template.refetch()}
              >
                Reintentar descarga
              </button>
            ) : null}
          </div>
          <p>Máximo 25 MB. Aceptamos la planilla .xlsx (o un CSV con los mismos encabezados).</p>
          <UploadField
            label="Planilla de productos"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
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
          <span className="wizard-card__step">Paso 2 de 3</span>
          <h2>Analizando archivo</h2>
          <p aria-live="polite">
            Detectamos encabezados y filas. Puedes dejar esta vista abierta.
          </p>
          <progress max={100} value={current?.progress ?? 0} />
        </section>
      ) : null}

      {current?.status === 'awaiting_mapping' ? (
        <section className="wizard-card">
          <span className="wizard-card__step">Paso 2 de 3</span>
          <h2>
            {usedTemplateHeaders
              ? 'Revisa la planilla y confirma'
              : 'Asocia las columnas'}
          </h2>
          <p>
            Archivo: <strong>{current.sourceFileName}</strong> ·{' '}
            {formatQuantity(current.totalRows)} filas
            {usedTemplateHeaders
              ? '. Usamos los encabezados de la planilla de Tenda.'
              : '. Asocia al menos el nombre del producto.'}
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
                    setPreviewedKey('')
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

          {preview.isPending ? (
            <p aria-live="polite">Validando las primeras filas…</p>
          ) : null}

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
          <span className="wizard-card__step">Paso 3 de 3</span>
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
            <p>{humanImportFailure(current.errorCode)}</p>
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
