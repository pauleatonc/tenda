export type StagedPhoto = {
  id: string
  file: File
  previewUrl: string
  assetId?: string
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
