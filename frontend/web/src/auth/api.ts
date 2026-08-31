import { request, TendaApiError } from '../lib/http'

export { TendaApiError }

export type ViewerPayload = {
  viewer: {
    id: string
    email: string
    emailVerified: boolean
    profile: {
      id: string
      fullName: string
      phone: string
      locale: string
    }
  }
  organisation: {
    id: string
    name: string
    timezone: string
    phone: string
    businessEmail: string
  }
  inventory: {
    id: string
    name: string
  }
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

export function registerAccount(input: {
  fullName: string
  email: string
  password: string
  acceptedTerms: boolean
  turnstileToken: string
}) {
  return request<{ message: string; verificationRequired: boolean }>(
    '/api/v1/auth/register',
    { method: 'POST', body: JSON.stringify(input) },
  )
}

export function login(input: { email: string; password: string; turnstileToken: string }) {
  return request<ViewerPayload>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function logout(allSessions = false) {
  return request<{ loggedOut: boolean }>('/api/v1/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ allSessions }),
  })
}

export function getViewer() {
  return request<ViewerPayload>('/api/v1/auth/viewer')
}

export function verifyEmail(token: string) {
  return request<ViewerPayload>('/api/v1/auth/email/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export function resendVerification(email: string) {
  return request<{ message: string }>('/api/v1/auth/email/verification/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function requestPasswordReset(email: string) {
  return request<{ message: string }>('/api/v1/auth/password/reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function confirmPasswordReset(token: string, password: string) {
  return request<{ message: string; sessionsRevoked: boolean }>(
    '/api/v1/auth/password/reset/confirm',
    {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    },
  )
}

export async function startGoogleLogin(): Promise<void> {
  const result = await request<{ authorizationUrl: string }>(
    '/api/v1/auth/social/google/start?client=web',
  )
  window.location.assign(result.authorizationUrl)
}

export function submitContact(input: {
  name: string
  email: string
  message: string
  turnstileToken: string
}) {
  return request<{ accepted: boolean; message: string }>('/api/v1/public/contact', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
