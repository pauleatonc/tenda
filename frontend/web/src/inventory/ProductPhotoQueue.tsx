import { useId } from 'react'

const MAX_CREATE_PHOTOS = 10

export type StagedPhoto = {
  id: string
  file: File
  previewUrl: string
}

export function createStagedPhoto(file: File): StagedPhoto {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    previewUrl: URL.createObjectURL ? URL.createObjectURL(file) : '',
  }
}

export function revokeStagedPhotos(photos: StagedPhoto[]) {
  for (const photo of photos) URL.revokeObjectURL(photo.previewUrl)
}

export function ProductPhotoQueue({
  photos,
  onAdd,
  onRemove,
  required = false,
}: {
  photos: StagedPhoto[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  required?: boolean
}) {
  const inputId = useId()
  const remaining = MAX_CREATE_PHOTOS - photos.length

  return (
    <div className="photo-queue">
      <p className="fieldset-hint">
        {required && !photos.length
          ? 'Sube al menos una foto para continuar. Puedes agregar hasta 10.'
          : `Hasta ${MAX_CREATE_PHOTOS} fotos. La primera será la principal.`}
      </p>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={remaining <= 0}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []).slice(0, remaining)
          if (files.length) onAdd(files)
          event.target.value = ''
        }}
      />
      <label className="button button--secondary button--compact" htmlFor={inputId}>
        {photos.length ? 'Agregar fotos' : 'Subir fotos'}
      </label>
      {photos.length ? (
        <ul className="photo-queue__list">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <img src={photo.previewUrl} alt="" />
              <span>{index === 0 ? 'Principal' : `Foto ${index + 1}`}</span>
              <button type="button" onClick={() => onRemove(photo.id)}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
