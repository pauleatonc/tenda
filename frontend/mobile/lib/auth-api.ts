import * as Linking from 'expo-linking'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'
const TOKEN_KEY = 'tenda.mobile.access-token'

export type MobileViewer = {
  viewer: {
    id: string
    email: string
    emailVerified: boolean
    profile: { id: string; fullName: string; phone: string; locale: string }
  }
  organisation: { id: string; name: string; timezone: string }
  inventory: { id: string; name: string }
  membership: {
    id: string
    role: 'owner' | 'operator' | 'support_admin'
    permissions: {
      viewFinancials: boolean
      manageMembers: boolean
      manageSensitiveConfiguration: boolean
      manageInventorySchema: boolean
    }
  }
}

type AuthResponse = MobileViewer & {
  accessToken: string
  tokenType: 'Bearer'
  expiresAt: string
}

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

export class MobileApiError extends Error {
  readonly code: string
  readonly correlationId: string
  readonly fieldErrors: Record<string, string[]>
  readonly retryable: boolean

  constructor(error: ApiFailure['error']) {
    super(error.message)
    this.name = 'MobileApiError'
    this.code = error.code
    this.correlationId = error.correlationId
    this.fieldErrors = error.fieldErrors ?? {}
    this.retryable = error.retryable ?? false
  }
}

export function getStoredToken() {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

async function saveAuth(response: AuthResponse): Promise<MobileViewer> {
  await SecureStore.setItemAsync(TOKEN_KEY, response.accessToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
  return response
}

export async function clearStoredToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}

async function request<T>(
  pathOrUrl: string,
  options: RequestInit = {},
  authenticated = false,
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('X-Tenda-Client', 'mobile')
  headers.set('Content-Type', 'application/json')
  if (authenticated) {
    const token = await getStoredToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${API_URL}${pathOrUrl}`
  const response = await fetch(url, { ...options, headers })
  const payload = (await response.json()) as ApiSuccess<T> | ApiFailure
  if (!response.ok || 'error' in payload) {
    const error =
      'error' in payload
        ? payload.error
        : {
            code: 'UNEXPECTED_ERROR',
            message: 'No pudimos completar la acción.',
            fieldErrors: {},
            correlationId: response.headers.get('X-Correlation-ID') ?? '',
          }
    throw new MobileApiError(error)
  }
  return payload.data
}

export function authenticatedRequest<T>(path: string, options: RequestInit = {}) {
  return request<T>(path, options, true)
}

export async function mobileLogin(
  email: string,
  password: string,
  turnstileToken = 'local-development',
) {
  const response = await request<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, turnstileToken }),
  })
  return saveAuth(response)
}

export function mobileRegister(input: {
  fullName: string
  email: string
  password: string
  acceptedTerms: boolean
  turnstileToken?: string
}) {
  return request<{ message: string; verificationRequired: boolean }>(
    '/api/v1/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({
        ...input,
        turnstileToken: input.turnstileToken || 'local-development',
      }),
    },
  )
}

export async function mobileVerifyEmail(token: string) {
  const response = await request<AuthResponse>('/api/v1/auth/email/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
  return saveAuth(response)
}

export function mobileResendVerification(email: string) {
  return request<{ message: string }>('/api/v1/auth/email/verification/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function mobileRequestPasswordReset(email: string) {
  return request<{ message: string }>('/api/v1/auth/password/reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function mobileConfirmPasswordReset(token: string, password: string) {
  return request<{ message: string; sessionsRevoked: boolean }>(
    '/api/v1/auth/password/reset/confirm',
    { method: 'POST', body: JSON.stringify({ token, password }) },
  )
}

export function getMobileViewer() {
  return request<MobileViewer>('/api/v1/auth/viewer', {}, true)
}

export async function mobileLogout() {
  try {
    await request<{ loggedOut: boolean }>(
      '/api/v1/auth/logout',
      { method: 'POST', body: '{}' },
      true,
    )
  } finally {
    await clearStoredToken()
  }
}

function parseGoogleRedirect(url: string): string {
  const fragment = url.split('#')[1] ?? ''
  const accessToken = new URLSearchParams(fragment).get('accessToken') ?? ''
  if (!accessToken) {
    throw new MobileApiError({
      code: 'OIDC_INVALID_RESPONSE',
      message: 'No pudimos completar el acceso con Google.',
      fieldErrors: {},
      correlationId: '',
    })
  }
  return accessToken
}

export async function mobileGoogleLogin() {
  const returnTo = Linking.createURL('auth/google')
  const start = await request<{ authorizationUrl: string }>(
    `/api/v1/auth/social/google/start?client=mobile&returnTo=${encodeURIComponent(returnTo)}`,
  )
  const result = await WebBrowser.openAuthSessionAsync(start.authorizationUrl, returnTo)
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new MobileApiError({
      code: 'OIDC_CANCELLED',
      message: 'Cancelaste el acceso con Google.',
      fieldErrors: {},
      correlationId: '',
    })
  }
  if (result.type !== 'success' || !result.url) {
    throw new MobileApiError({
      code: 'OIDC_INVALID_RESPONSE',
      message: 'No pudimos completar el acceso con Google.',
      fieldErrors: {},
      correlationId: '',
    })
  }
  await SecureStore.setItemAsync(TOKEN_KEY, parseGoogleRedirect(result.url), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  })
  return getMobileViewer()
}
