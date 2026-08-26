import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { UploadField } from '../components/ui'
import { TendaApiError } from '../lib/http'
import {
  attachProductMedia,
  inventoryKeys,
  removeProductMedia,
  setPrimaryProductMedia,
  uploadPrivateFile,
  type ProductMedia,
} from './api'

export function ProductMediaGallery({
  productId,
  media,
  archived = false,
}: {
  productId: string
  media: ProductMedia[]
  archived?: boolean
}) {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<number | null>(null)
  const [failedFile, setFailedFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.product(productId) })
  }

  const upload = useMutation({
    mutationFn: async (file: File) => {
      setError('')
      setFailedFile(null)
      setProgress(0)
      const assetId = await uploadPrivateFile(file, 'product_image', setProgress)
      return attachProductMedia(productId, assetId, media.length === 0)
    },
    onSuccess: () => {
      setProgress(null)
      refresh()
    },
    onError: (uploadError: unknown, file) => {
      setFailedFile(file)
      setProgress(null)
      setError(
        uploadError instanceof TendaApiError
          ? uploadError.message
          : uploadError instanceof Error
            ? uploadError.message
            : 'No pudimos cargar la foto.',
      )
    },
  })

  const primary = useMutation({
    mutationFn: (assetId: string) => setPrimaryProductMedia(productId, assetId),
    onSuccess: refresh,
    onError: (actionError: unknown) =>
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'No pudimos cambiar la foto principal.',
      ),
  })

  const remove = useMutation({
    mutationFn: (assetId: string) => removeProductMedia(productId, assetId),
    onSuccess: refresh,
    onError: (actionError: unknown) =>
      setError(
        actionError instanceof Error ? actionError.message : 'No pudimos eliminar la foto.',
      ),
  })

  return (
    <section className="detail-section product-media" aria-labelledby="product-media-title">
      <div className="detail-section__header">
        <div>
          <h2 id="product-media-title">Fotos</h2>
          <p className="detail-section__lead">
            Archivos privados. La foto principal aparece primero en la galería.
          </p>
        </div>
        {!archived ? (
          <UploadField
            label="Agregar foto"
            accept="image/jpeg,image/png,image/webp"
            disabled={upload.isPending || media.length >= 10}
            onSelect={(file) => upload.mutate(file)}
          />
        ) : null}
      </div>

      {progress !== null ? (
        <div className="upload-progress" aria-live="polite">
          <progress max={100} value={progress} />
          <span>Cargando foto: {progress}%</span>
        </div>
      ) : null}

      {error ? (
        <div className="form-message form-message--error" role="alert">
          <span>{error}</span>
          {failedFile ? (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => upload.mutate(failedFile)}
            >
              Reintentar carga
            </button>
          ) : null}
        </div>
      ) : null}

      {media.length ? (
        <ul className="product-media__grid">
          {[...media]
            .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))
            .map((item) => (
              <li key={item.assetId}>
                <img src={item.url} alt={item.originalName} />
                <div>
                  <strong>{item.isPrimary ? 'Foto principal' : item.originalName}</strong>
                  <div className="row-actions">
                    {!item.isPrimary ? (
                      <button
                        className="text-link"
                        type="button"
                        disabled={primary.isPending}
                        onClick={() => primary.mutate(item.assetId)}
                      >
                        Usar como principal
                      </button>
                    ) : null}
                    <button
                      className="text-link text-link--danger"
                      type="button"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm('¿Eliminar esta foto del producto?')) {
                          remove.mutate(item.assetId)
                        }
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </li>
            ))}
        </ul>
      ) : (
        <p className="detail-card__empty">Este producto todavía no tiene fotos.</p>
      )}
    </section>
  )
}
