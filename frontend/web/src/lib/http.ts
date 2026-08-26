import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { print } from 'graphql'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

type ApiSuccess<T> = { data: T }
type ApiFailure = {
  error: {
    code: string
    message: string
    fieldErrors: Record<string, string[]>
    correlationId: string
    retryable?: boolean
  }
}

export class TendaApiError extends Error {
  readonly code: string
  readonly fieldErrors: Record<string, string[]>
  readonly correlationId: string
  readonly status: number
  readonly retryable: boolean

  constructor(failure: ApiFailure['error'], status: number) {
    super(failure.message)
    this.name = 'TendaApiError'
    this.code = failure.code
    this.fieldErrors = failure.fieldErrors ?? {}
    this.correlationId = failure.correlationId ?? ''
    this.status = status
    this.retryable = failure.retryable ?? false
  }
}

let csrfToken: string | null = null

async function refreshCsrf(): Promise<string> {
  const response = await fetch(`${API_URL}/api/v1/auth/csrf`, {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error('No fue posible iniciar una sesión segura.')
  }
  const payload = (await response.json()) as ApiSuccess<{ csrfToken: string }>
  csrfToken = payload.data.csrfToken
  return csrfToken
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  retryCsrf = true,
): Promise<T> {
  const method = options.method?.toUpperCase() ?? 'GET'
  const headers = new Headers(options.headers)
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('Content-Type', 'application/json')
    headers.set('X-CSRFToken', csrfToken ?? (await refreshCsrf()))
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })
  const payload = (await response.json()) as ApiSuccess<T> | ApiFailure
  if (!response.ok || 'error' in payload) {
    const failure = 'error' in payload ? payload.error : null
    if (failure?.code === 'CSRF_FAILED' && retryCsrf) {
      csrfToken = null
      return request<T>(path, options, false)
    }
    throw new TendaApiError(
      failure ?? {
        code: 'UNEXPECTED_ERROR',
        message: 'Ocurrió un error inesperado.',
        fieldErrors: {},
        correlationId: response.headers.get('X-Correlation-ID') ?? '',
      },
      response.status,
    )
  }
  return payload.data
}

/**
 * Uploads bytes to a presigned R2 URL (or the local fake adapter) and exposes
 * native progress. The local adapter keeps CSRF/session protection; R2 never
 * receives browser credentials.
 */
export async function uploadBinary(
  url: string,
  file: File,
  requiredHeaders: Record<string, string>,
  onProgress?: (percentage: number) => void,
): Promise<void> {
  const apiOrigin = new URL(API_URL, window.location.href).origin
  const uploadOrigin = new URL(url, window.location.href).origin
  const isLocalAdapter = apiOrigin === uploadOrigin
  const headers = { ...requiredHeaders }
  if (isLocalAdapter) {
    headers['X-CSRFToken'] = csrfToken ?? (await refreshCsrf())
  }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.withCredentials = isLocalAdapter
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve()
      } else {
        reject(new Error('No pudimos cargar el archivo. Inténtalo nuevamente.'))
      }
    })
    xhr.addEventListener('error', () => {
      reject(new Error('La conexión se interrumpió durante la carga.'))
    })
    xhr.send(file)
  })
}

type GraphQLFailure = {
  message: string
  extensions?: {
    code?: string
    fieldErrors?: Record<string, string[]>
    correlationId?: string
    retryable?: boolean
  }
}

/**
 * Executes a generated document so the client and the Django schema can never
 * drift: the operations live in `@tenda/api-client` and are checked in CI.
 */
export async function graphqlRequest<TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables?: TVariables,
  retryCsrf = true,
): Promise<TResult> {
  const response = await fetch(`${API_URL}/graphql/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken ?? (await refreshCsrf()),
    },
    body: JSON.stringify({ query: print(document), variables: variables ?? {} }),
  })
  const payload = (await response.json()) as {
    data?: TResult
    errors?: GraphQLFailure[]
    error?: { code?: string }
  }
  const csrfFailed =
    payload.error?.code === 'CSRF_FAILED' ||
    payload.errors?.[0]?.extensions?.code === 'CSRF_FAILED'
  if (csrfFailed && retryCsrf) {
    csrfToken = null
    return graphqlRequest(document, variables, false)
  }
  const failure = payload.errors?.[0]
  if (failure) {
    if (failure.extensions?.code === 'CSRF_FAILED' && retryCsrf) {
      csrfToken = null
      return graphqlRequest(document, variables, false)
    }
    throw new TendaApiError(
      {
        code: failure.extensions?.code ?? 'UNEXPECTED_ERROR',
        message: failure.message,
        fieldErrors: failure.extensions?.fieldErrors ?? {},
        correlationId: failure.extensions?.correlationId ?? '',
        retryable: failure.extensions?.retryable ?? false,
      },
      response.status,
    )
  }
  if (!payload.data) {
    throw new TendaApiError(
      {
        code: 'UNEXPECTED_ERROR',
        message: 'Ocurrió un error inesperado.',
        fieldErrors: {},
        correlationId: response.headers.get('X-Correlation-ID') ?? '',
      },
      response.status,
    )
  }
  return payload.data
}

/** A stable idempotency key for one submitted form or action. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}
