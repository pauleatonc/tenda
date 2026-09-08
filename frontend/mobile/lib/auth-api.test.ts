import * as Linking from 'expo-linking'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'

import { MobileApiError, mobileGoogleLogin } from './auth-api'

const mockFetch = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as typeof fetch
  jest.mocked(Linking.createURL).mockReturnValue('tenda://auth/google')
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined)
})

test('mobileGoogleLogin opens Google and stores the token from the app redirect', async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc' },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          viewer: {
            id: '1',
            email: 'ada@example.com',
            emailVerified: true,
            profile: { id: 'p', fullName: 'Ada', phone: '', locale: 'es', photoUrl: null },
          },
          organisation: {
            id: 'o',
            name: 'Tenda',
            timezone: 'America/Santiago',
            address: '',
            description: '',
            logoUrl: null,
          },
          inventory: { id: 'i', name: 'Principal' },
          membership: {
            id: 'm',
            role: 'owner',
            roleLabel: 'titular',
            permissions: {
              viewFinancials: true,
              manageMembers: true,
              manageSensitiveConfiguration: true,
              manageInventorySchema: true,
            },
          },
        },
      }),
    })
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
    type: 'success',
    url: 'tenda://auth/google#accessToken=tenda_abc_secret&tokenType=Bearer',
  })

  const viewer = await mobileGoogleLogin()

  expect(mockFetch).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining(
      '/api/v1/auth/social/google/start?client=mobile&returnTo=tenda%3A%2F%2Fauth%2Fgoogle',
    ),
    expect.anything(),
  )
  expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
    'https://accounts.google.com/o/oauth2/v2/auth?state=abc',
    'tenda://auth/google',
  )
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    'tenda.mobile.access-token',
    'tenda_abc_secret',
    expect.anything(),
  )
  expect(viewer.viewer.email).toBe('ada@example.com')
})

test('mobileGoogleLogin surfaces a cancellation from the system browser', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: { authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth' },
    }),
  })
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({ type: 'cancel' })

  await expect(mobileGoogleLogin()).rejects.toMatchObject({
    code: 'OIDC_CANCELLED',
  } satisfies Partial<MobileApiError>)
})
