import { defineConfig, devices } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const webOrigin = process.env.WEB_ORIGIN ?? 'http://127.0.0.1:15173'
const apiOrigin = process.env.VITE_API_URL ?? 'http://127.0.0.1:18000'
const web = new URL(webOrigin)
const api = new URL(apiOrigin)
const apiPort = api.port || '8000'
const webPort = web.port || '5173'
const ci = Boolean(process.env.CI)

function webServerEnv(extra: Record<string, string>): Record<string, string> {
  const inherited: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) inherited[key] = value
  }
  return { ...inherited, ...extra }
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['list']] : 'list',
  use: {
    baseURL: webOrigin,
    locale: 'es-CL',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `uv run --project backend python backend/manage.py migrate --noinput && uv run --project backend python backend/manage.py runserver ${api.hostname}:${apiPort}`,
      url: `${apiOrigin}/health/live/`,
      reuseExistingServer: !ci,
      timeout: 120_000,
      cwd: root,
      env: webServerEnv({
        DJANGO_SETTINGS_MODULE:
          process.env.DJANGO_SETTINGS_MODULE ?? 'tenda.settings.local',
        DJANGO_SECRET_KEY:
          process.env.DJANGO_SECRET_KEY ?? 'e2e-local-not-a-production-secret',
        DJANGO_ALLOWED_HOSTS: process.env.DJANGO_ALLOWED_HOSTS ?? 'localhost,127.0.0.1',
        DJANGO_CSRF_TRUSTED_ORIGINS: process.env.DJANGO_CSRF_TRUSTED_ORIGINS ?? webOrigin,
        WEB_ORIGIN: webOrigin,
        PUBLIC_ORIGIN: webOrigin,
        VITE_API_URL: apiOrigin,
        AGENT_FEATURE_STATUS: 'coming_soon',
        TURNSTILE_FAKE_MODE: 'true',
        OBJECT_STORAGE_PROVIDER: 'fake',
        EMAIL_PROVIDER: 'fake',
        PAYMENT_PROVIDER: 'fake',
        OUTBOX_EAGER: 'true',
      }),
    },
    {
      command: `node_modules/.bin/vite --host ${web.hostname} --port ${webPort}`,
      url: webOrigin,
      reuseExistingServer: !ci,
      timeout: 120_000,
      cwd: resolve(root, 'frontend/web'),
      env: webServerEnv({ VITE_API_URL: apiOrigin }),
    },
  ],
})
