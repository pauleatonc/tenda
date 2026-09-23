import { expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const E2E_EMAIL = 'e2e.owner@tenda.test'
const E2E_PASSWORD = 'Correct-Horse-Battery-42'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const pngPixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

function manage(args: string[]): void {
  execFileSync(
    'uv',
    ['run', '--project', 'backend', 'python', 'backend/manage.py', ...args],
    { cwd: root, stdio: 'pipe' },
  )
}

export function prepareE2eOwner(): void {
  manage(['migrate', '--noinput'])
  manage([
    'prepare_e2e_journey',
    '--email',
    E2E_EMAIL,
    '--password',
    E2E_PASSWORD,
  ])
}

export async function loginAsOwner(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Correo').fill(E2E_EMAIL)
  await page.getByLabel('Contraseña').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.getByRole('heading', { name: /Hola,/ })).toBeVisible({
    timeout: 20_000,
  })
}

export async function createCatalogProduct(page: Page, name: string): Promise<void> {
  await page.getByRole('link', { name: 'Inventario', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible()
  await page
    .getByRole('link', { name: /Agregar producto|Crear producto/ })
    .first()
    .click()
  await page.getByRole('link', { name: 'Carga manual' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo producto' })).toBeVisible()
  await page.getByLabel('Nombre').fill(name)
  await page.getByLabel('Cantidad inicial').fill('5')
  await page.getByLabel('Precio de compra').fill('2000')
  await page.getByLabel('Precio de venta').fill('5000')
  await page.getByRole('button', { name: 'Crear producto' }).click()
  await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible()
  await expect(page.getByRole('link', { name })).toBeVisible({ timeout: 20_000 })
}

export async function publishShippingSale(
  page: Page,
  productName: string,
): Promise<string> {
  await page.evaluate(() => window.localStorage.removeItem('tenda.sales.new-draft.v1'))
  await page.getByRole('link', { name: 'Ventas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Ventas' })).toBeVisible()
  await page.getByRole('link', { name: 'Nueva venta' }).click()
  await expect(page.getByRole('heading', { name: 'Nueva venta' })).toBeVisible()
  await page.getByLabel('Buscar productos activos').fill(productName)
  await page.getByRole('button', { name: 'Agregar línea' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(
    page.getByRole('heading', { name: 'Entrega y método de pago' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Revisar venta' }).click()
  await page.getByRole('button', { name: 'Crear y obtener enlace' }).click()
  await expect(page.getByRole('heading', { name: 'Tu enlace está listo' })).toBeVisible()
  const publicUrl = await page.locator('input[readonly]').inputValue()
  expect(publicUrl).toContain('/p/')
  return publicUrl
}

export async function completeBankTransferPurchase(
  page: Page,
  publicOrderUrl: string,
): Promise<void> {
  await page.goto(publicOrderUrl)
  await page.getByRole('link', { name: 'Comprar' }).click()
  await page.getByLabel('Nombre').fill('Camila Soto')
  await page.getByLabel('Email').fill('camila.e2e@example.test')
  await page.getByLabel('Teléfono').fill('+56911111111')
  await page.getByLabel('Destinatario').fill('Camila Soto')
  await page.getByLabel('Dirección').fill('Los Aromos 123')
  await page.getByLabel('Región').selectOption('Región Metropolitana de Santiago')
  await page.getByLabel('Comuna').selectOption('Ñuñoa')
  await page.getByRole('button', { name: 'Continuar al pago' }).click()
  await page.getByRole('button', { name: 'Revisar compra' }).click()
  await page.getByRole('button', { name: 'Confirmar datos' }).click()
  await expect(page.getByRole('heading', { name: 'Envía tu comprobante' })).toBeVisible()
  await page
    .getByLabel('Selecciona una foto o PDF del comprobante')
    .setInputFiles({ name: 'comprobante.png', mimeType: 'image/png', buffer: pngPixel })
  await page.getByRole('button', { name: 'Enviar comprobante' }).click()
  await expect(page.getByRole('heading', { name: 'Comprobante enviado' })).toBeVisible()
}

export async function approveProofAndRegisterDispatch(page: Page): Promise<void> {
  await page.goto('/app/ventas')
  await expect(page.getByRole('heading', { name: 'Ventas' })).toBeVisible()
  await page.locator('.sales-table__number').first().click()
  await page.getByRole('button', { name: 'Aprobar comprobante' }).click()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByRole('heading', { name: /Pagado|Vendido/ })).toBeVisible()

  await page.getByRole('link', { name: 'Balances', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Balance de ventas' })).toBeVisible()
  await expect(page.getByRole('link', { name: '$5.000' }).first()).toBeVisible()

  await page.getByRole('link', { name: 'Despachos', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Despachos' })).toBeVisible()
  await page.locator('.sales-table__number').first().click()
  await expect(page.getByRole('heading', { name: 'Pendiente' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Registrar despacho' })).toBeVisible()
  await page.getByLabel('Transportista').fill('Chilexpress')
  await page.getByLabel('Código de tracking (opcional)').fill('CX-E2E-01')
  await page.getByRole('button', { name: 'Registrar despacho' }).click()
  await page.getByRole('button', { name: 'Confirmar y notificar' }).click()
  await expect(page.getByRole('heading', { name: 'Despachado' })).toBeVisible()
  await expect(page.getByText('CX-E2E-01')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar despacho' })).toHaveCount(0)
}
