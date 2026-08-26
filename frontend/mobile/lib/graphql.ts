import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { randomUUID } from 'expo-crypto'
import { print } from 'graphql'

import { MobileApiError, getStoredToken } from './auth-api'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'

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
 * The phone can lose signal mid-request. We surface that as a first-class error
 * so screens can keep the draft on screen instead of pretending the write
 * landed: Tenda never queues mutations offline.
 */
export const NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE'

export function isOfflineError(error: unknown): boolean {
  return error instanceof MobileApiError && error.code === NETWORK_UNAVAILABLE
}

/**
 * Runs a document generated from the Django schema, so mobile and backend can
 * never drift apart. Bearer + `X-Tenda-Client: mobile` skips the browser-only
 * CSRF handshake.
 */
export async function graphqlRequest<TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables?: TVariables,
): Promise<TResult> {
  const token = await getStoredToken()
  let response: Response
  try {
    response = await fetch(`${API_URL}/graphql/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenda-Client': 'mobile',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query: print(document), variables: variables ?? {} }),
    })
  } catch {
    throw new MobileApiError({
      code: NETWORK_UNAVAILABLE,
      message: 'Sin conexión. No enviamos nada; tus datos siguen en pantalla.',
      fieldErrors: {},
      correlationId: '',
      retryable: true,
    })
  }

  const payload = (await response.json()) as {
    data?: TResult
    errors?: GraphQLFailure[]
  }
  const failure = payload.errors?.[0]
  if (failure) {
    throw new MobileApiError({
      code: failure.extensions?.code ?? 'UNEXPECTED_ERROR',
      message: failure.message,
      fieldErrors: failure.extensions?.fieldErrors ?? {},
      correlationId: failure.extensions?.correlationId ?? '',
      retryable: failure.extensions?.retryable ?? false,
    })
  }
  if (!payload.data) {
    throw new MobileApiError({
      code: 'UNEXPECTED_ERROR',
      message: 'No pudimos completar la acción.',
      fieldErrors: {},
      correlationId: response.headers.get('X-Correlation-ID') ?? '',
    })
  }
  return payload.data
}

/** A stable key so a retried submit never duplicates a product or movement. */
export function newIdempotencyKey(): string {
  return randomUUID()
}
