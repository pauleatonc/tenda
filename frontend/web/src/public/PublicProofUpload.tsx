import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { UploadField } from '../components/ui'
import { TendaApiError } from '../lib/http'
import { salesKeys, uploadPublicPaymentProof, type PublicOrder } from '../sales/api'
import { formatClp } from '../sales/model'
import { BankTransferDetails } from './BankTransferDetails'
import { hasRequiredDelivery } from './publicDelivery'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export function PublicProofUpload({
  token,
  order,
  showBankInstructions = true,
  requireDelivery = false,
}: {
  token: string
  order: PublicOrder
  showBankInstructions?: boolean
  requireDelivery?: boolean
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [fileError, setFileError] = useState('')
  const [complete, setComplete] = useState(false)

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

  const deliveryReady = !requireDelivery || hasRequiredDelivery(order.buyer)
  const canUpload =
    order.paymentMethod === 'bank_transfer' &&
    ['reserved', 'purchase_in_progress'].includes(order.status)

  return (
    <div className="public-proof-upload">
      {showBankInstructions ? (
        <BankTransferDetails
          details={order.bankDetails}
          instructions={order.bankTransferInstructions}
        />
      ) : null}

      {!canUpload && !complete ? (
        <div className="public-upload-success" role="status">
          <h2>Comprobante en revisión</h2>
          <p>
            El vendedor validará el archivo antes de confirmar el pago. La reserva
            queda pausada mientras tanto.
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
          <p>
            Transfiere exactamente <strong>{formatClp(order.total)}</strong>. Subir el
            archivo no aprueba el pago: el vendedor debe validarlo.
          </p>
          {!deliveryReady ? (
            <p className="field__error" role="status">
              Completa y guarda los datos de despacho para enviar el comprobante.
            </p>
          ) : null}
          <UploadField
            label="Selecciona una foto o PDF del comprobante"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onSelect={selectFile}
            disabled={!deliveryReady || upload.isPending}
          />
          {fileError ? (
            <p className="field__error" role="alert">
              {fileError}
            </p>
          ) : null}
          {file ? (
            <div className="public-proof-preview">
              {previewUrl ? (
                <img src={previewUrl} alt="Vista previa del comprobante seleccionado" />
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
            </div>
          ) : null}

          <button
            className="button button--primary button--wide"
            type="button"
            disabled={!deliveryReady || !file || upload.isPending}
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
    </div>
  )
}
