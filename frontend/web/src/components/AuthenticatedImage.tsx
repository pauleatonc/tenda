import { useEffect, useState } from 'react'

import { API_URL } from '../lib/http'

export function AuthenticatedImage({
  src,
  alt,
  className,
}: {
  src: string | null | undefined
  alt: string
  className?: string
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!src) {
      setBlobUrl(null)
      return
    }
    const absolute = src.startsWith('http') ? src : `${API_URL}${src}`
    const sameApi = absolute.startsWith(API_URL)
    if (!sameApi) {
      setBlobUrl(absolute)
      return
    }
    const controller = new AbortController()
    let objectUrl: string | null = null
    void fetch(absolute, { credentials: 'include', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('image')
        return response.blob()
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      })
      .catch(() => {
        if (!controller.signal.aborted) setBlobUrl(null)
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  if (!blobUrl) return null
  return <img src={blobUrl} alt={alt} className={className} />
}

export function PersonAvatar({
  name,
  photoUrl,
  className = 'avatar',
}: {
  name: string
  photoUrl?: string | null
  className?: string
}) {
  const initial = (name || '?').slice(0, 1).toUpperCase()
  return (
    <span className={className} aria-hidden="true">
      <span className="avatar__fallback">{initial}</span>
      {photoUrl ? <AuthenticatedImage src={photoUrl} alt="" /> : null}
    </span>
  )
}
