import * as ImagePicker from 'expo-image-picker'

import {
  MobileApiError,
  authenticatedRequest,
  getStoredToken,
} from './auth-api'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'

export type PickedImage = {
  uri: string
  fileName: string
  contentType: string
  size: number
}

function uploadError(code: string, message: string, retryable = false) {
  return new MobileApiError({
    code,
    message,
    fieldErrors: {},
    correlationId: '',
    retryable,
  })
}

export async function pickProductImage(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw uploadError(
      'MEDIA_PERMISSION_REQUIRED',
      'Permite acceso a tus fotos para agregar una imagen al producto.',
    )
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.9,
  })
  if (result.canceled) return null
  const image = result.assets[0]
  const blob = await (await fetch(image.uri)).blob()
  return {
    uri: image.uri,
    fileName: image.fileName || `producto-${Date.now()}.jpg`,
    contentType: image.mimeType || 'image/jpeg',
    size: image.fileSize ?? blob.size,
  }
}

export async function uploadProductImage(
  image: PickedImage,
  onProgress?: (percentage: number) => void,
): Promise<string> {
  const prepared = await authenticatedRequest<{
    assetId: string
    uploadUrl: string
    headers: Record<string, string>
    expiresIn: number
  }>('/api/v1/media/uploads/prepare', {
    method: 'POST',
    body: JSON.stringify({
      purpose: 'product_image',
      fileName: image.fileName,
      contentType: image.contentType,
      size: image.size,
    }),
  })
  const blob = await (await fetch(image.uri)).blob()
  const headers = { ...prepared.headers }
  const isLocalAdapter = prepared.uploadUrl.startsWith(API_URL)
  if (isLocalAdapter) {
    const token = await getStoredToken()
    headers['X-Tenda-Client'] = 'mobile'
    if (token) headers.Authorization = `Bearer ${token}`
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', prepared.uploadUrl)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve()
      } else {
        reject(uploadError('UPLOAD_FAILED', 'No pudimos cargar la foto.', true))
      }
    }
    xhr.onerror = () => {
      reject(
        uploadError(
          'NETWORK_UNAVAILABLE',
          'La conexión se interrumpió. La foto no quedó asociada.',
          true,
        ),
      )
    }
    xhr.send(blob)
  })

  await authenticatedRequest<{ assetId: string; status: string }>(
    '/api/v1/media/uploads/complete',
    {
      method: 'POST',
      body: JSON.stringify({ assetId: prepared.assetId }),
    },
  )
  return prepared.assetId
}
