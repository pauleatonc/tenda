import { useEffect, useState } from 'react'

import { API_URL } from '../lib/http'

type CacheEntry = {
  objectUrl: string
  refCount: number
}

const blobCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<string>>()

function releaseBlob(absoluteUrl: string): void {
  const entry = blobCache.get(absoluteUrl)
  if (!entry) return
  entry.refCount -= 1
  if (entry.refCount > 0) return
  blobCache.delete(absoluteUrl)
  URL.revokeObjectURL(entry.objectUrl)
}

async function acquireAuthenticatedBlob(
  absoluteUrl: string,
  signal: AbortSignal,
): Promise<string> {
  const cached = blobCache.get(absoluteUrl)
  if (cached) {
    cached.refCount += 1
    return cached.objectUrl
  }

  let pending = inflight.get(absoluteUrl)
  if (!pending) {
    pending = fetch(absoluteUrl, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('image')
        return response.blob()
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob)
        blobCache.set(absoluteUrl, { objectUrl, refCount: 0 })
        inflight.delete(absoluteUrl)
        return objectUrl
      })
      .catch((error: unknown) => {
        inflight.delete(absoluteUrl)
        throw error
      })
    inflight.set(absoluteUrl, pending)
  }

  const objectUrl = await pending
  const entry = blobCache.get(absoluteUrl)
  if (!entry) {
    throw new Error('image cache missing')
  }
  if (signal.aborted) {
    if (entry.refCount === 0) {
      blobCache.delete(absoluteUrl)
      URL.revokeObjectURL(entry.objectUrl)
    }
    throw new DOMException('Aborted', 'AbortError')
  }
  entry.refCount += 1
  return entry.objectUrl
}

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
    let held = false
    void acquireAuthenticatedBlob(absolute, controller.signal)
      .then((url) => {
        held = true
        setBlobUrl(url)
      })
      .catch(() => {
        if (!controller.signal.aborted) setBlobUrl(null)
      })

    return () => {
      controller.abort()
      if (held) releaseBlob(absolute)
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
