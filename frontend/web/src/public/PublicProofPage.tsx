import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { UploadField } from '../components/ui'
import { TendaApiError } from '../lib/http'
import { fetchPublicOrder, salesKeys, uploadPublicPaymentProof } from '../sales/api'
import { formatClp } from '../sales/model'
import {
  PublicOrderSummary,
  PublicOrderUnavailable,
  PublicPage,
} from './PublicOrderComponents'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export function PublicProofPage() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [fileError, setFileError] = useState('')
  const [complete, setComplete] = useState(false)

  const order = useQuery({
    queryKey: salesKeys.publicOrder(token),
    queryFn: () => fetchPublicOrder(token),
    enabled: Boolean(token),
    retry: 1,
  })

  const previewUrl = useMemo(
    () => (file?.type.startsWith('image/') ? URL.createObjectURL(file) : null),
    [file],
  )

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl],
  )

  const upload = useMutation({
    mutationFn: (selected: File) =>
      uploadPublicPaymentProof(token, selected, setProgress),
    onSuccess: () => {
      setComplete(true)
      void queryClient.invalidateQueries({ queryKey: salesKeys.publicOrder(token) })
      void queryClient.invalidateQueries({ queryKey: salesKeys.publicStatus(token) })
    },
  })

  function selectFile(selected: File) {
    setComplete(false)
    setProgress(0)
    if (
      !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(
        selected.type,
      )
    ) {
      setFile(null)
      setFileError('Usa una imagen JPG, PNG, WebP o un PDF.')
      return
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      setFile(null)
      setFileError('El archivo no puede superar 10 MB.')
      return
    }
    setFileError('')
    setFile(selected)
  }

  if (order.isPending) {
    return (
      <PublicPage>
        <div className="public-skeleton" aria-busy="true">
          <span className="sr-only">Cargando instrucciones de transferencia…</span>
          <div />
          <div />
        </div>
      </PublicPage>
    )
  }

  if (order.isError || !order.data) {
    const expired =
      order.error instanceof TendaApiError &&
      ['ORDER_EXPIRED', 'PUBLIC_TOKEN_EXPIRED'].includes(order.error.code)
    return (
      <PublicOrderUnavailable
        expired={expired}
        onRetry={expired ? undefined : () => void order.refetch()}
      />
    )
  }

  if (order.data.status === 'expired') return <PublicOrderUnavailable expired />
  const detail = order.data
  const canUpload =
    detail.paymentMethod === 'bank_transfer' &&
    ['reserved', 'purchase_in_progress'].includes(detail.status)

  return (
    <PublicPage seller={detail.seller}>
      <div className="public-proof-layout">
        <section className="public-proof-card">
          <Link to={`/p/${token}/comprar`}>← Volver al checkout</Link>
          <p className="eyebrow">Transferencia bancaria</p>
          <h1>Envía tu comprobante</h1>
          <p>
            Transfiere exactamente <strong>{formatClp(detail.total)}</strong>. Subir el
            archivo no aprueba el pago: el vendedor debe validarlo.
          </p>

          <div className="bank-instructions">
            <h2>Datos para transferir</h2>
            <p>{detail.bankTransferInstructions || 'Solicita los datos al vendedor.'}</p>
          </div>

          {!canUpload && !complete ? (
            <div className="public-upload-success" role="status">
              <h2>Este pedido no admite otra carga</h2>
              <p>
                El método o el estado actual ya no permite enviar un comprobante. Revisa
                el estado para conocer el siguiente paso.
              </p>
              <Link className="button button--primary" to={`/p/${token}/estado`}>
                Ver estado
              </Link>
            </div>
          ) : complete ? (
            <div className="public-upload-success" role="status">
              <span aria-hidden="true">✓</span>
              <h2>Comprobante enviado</h2>
              <p>
                La compra quedó en validación. El vendedor revisará el archivo antes de
                confirmar el pago y descontar stock.
              </p>
              <button
                className="button button--primary"
                type="button"
                onClick={() => navigate(`/p/${token}/estado`)}
              >
                Ver estado
              </button>
            </div>
          ) : (
            <>
              <UploadField
                label="Selecciona una foto o PDF del comprobante"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onSelect={selectFile}
                disabled={upload.isPending}
              />
              {fileError ? (
                <p className="field__error" role="alert">
                  {fileError}
                </p>
              ) : null}
              {file ? (
                <div className="public-proof-preview">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Vista previa del comprobante seleccionado"
                    />
                  ) : (
                    <span aria-hidden="true">PDF</span>
                  )}
                  <div>
                    <strong>{file.name}</strong>
                    <small>{Math.ceil(file.size / 1024)} KB</small>
                  </div>
                </div>
              ) : null}

              {upload.isPending || progress > 0 ? (
                <div className="upload-progress" aria-live="polite">
                  <label htmlFor="proof-upload-progress">Carga {progress}%</label>
                  <progress id="proof-upload-progress" max={100} value={progress} />
                </div>
              ) : null}

              {upload.isError ? (
                <div className="form-message form-message--error" role="alert">
                  <strong>No pudimos cargar el comprobante</strong>
                  <span>
                    {upload.error instanceof TendaApiError
                      ? upload.error.message
                      : upload.error.message ||
                        'La conexión se interrumpió. El archivo no quedó confirmado.'}
                  </span>
                  <small>
                    Puedes reintentar con el mismo archivo. Prepararemos una nueva carga
                    contextual para este pedido.
                  </small>
                </div>
              ) : null}

              <button
                className="button button--primary button--wide"
                type="button"
                disabled={!file || upload.isPending}
                onClick={() => {
                  if (file) {
                    setProgress(0)
                    upload.mutate(file)
                  }
                }}
              >
                {upload.isPending ? `Subiendo ${progress}%…` : 'Enviar comprobante'}
              </button>
            </>
          )}
        </section>

        <PublicOrderSummary order={detail} compact />
      </div>
    </PublicPage>
  )
}
