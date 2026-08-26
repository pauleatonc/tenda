import { expect, test } from '@playwright/test'

import {
  approveProofAndOpenShipment,
  completeBankTransferPurchase,
  createCatalogProduct,
  loginAsOwner,
  prepareE2eOwner,
  publishShippingSale,
} from './helpers'

test.beforeAll(() => {
  prepareE2eOwner()
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem('tenda.sales.new-draft.v1')
  })
})

test('login → inventario → venta → pago → balance → despacho → recepción', async ({
  page,
}) => {
  const productName = `Vela E2E ${Date.now()}`
  await loginAsOwner(page)
  await createCatalogProduct(page, productName)
  const orderUrl = await publishShippingSale(page, productName)
  await completeBankTransferPurchase(page, orderUrl)
  const shipmentUrl = await approveProofAndOpenShipment(page)

  await page.goto(shipmentUrl)
  await page.getByRole('link', { name: '¿Recibiste tu pedido?' }).click()
  await page.getByRole('button', { name: 'Sí, lo recibí' }).click()
  await page.getByRole('button', { name: 'Confirmar recepción' }).click()
  await expect(page.getByText('Ya confirmaste que recibiste este pedido.')).toBeVisible()

  await page.goto(`${shipmentUrl.replace(/\/$/, '')}/confirmar`)
  await expect(
    page.getByRole('heading', { name: 'Ya confirmaste que lo recibiste' }),
  ).toBeVisible()
})

test('la respuesta pública No abre una consulta y no marca incidencia', async ({
  page,
}) => {
  const productName = `Bolso E2E ${Date.now()}`
  await loginAsOwner(page)
  await createCatalogProduct(page, productName)
  const orderUrl = await publishShippingSale(page, productName)
  await completeBankTransferPurchase(page, orderUrl)
  const shipmentUrl = await approveProofAndOpenShipment(page)

  await page.goto(shipmentUrl)
  await page.getByRole('link', { name: '¿Recibiste tu pedido?' }).click()
  await page.getByRole('button', { name: 'No, necesito ayuda' }).click()
  await expect(
    page.getByRole('heading', { name: 'Conversación con el vendedor' }),
  ).toBeVisible()
  await page
    .getByLabel('Tu respuesta')
    .fill('El paquete no ha llegado a la dirección indicada.')
  await page.getByRole('button', { name: 'Enviar mensaje' }).click()
  await expect(
    page.getByText('El paquete no ha llegado a la dirección indicada.'),
  ).toBeVisible()

  await page.goto('/app/despachos')
  await page.locator('.sales-table__number').first().click()
  await expect(page.getByRole('heading', { name: 'Incidencia' })).toHaveCount(0)
  await expect(page.getByText('No, necesito ayuda')).toBeVisible()
  await expect(page.getByRole('link', { name: /Abrir consulta/ })).toBeVisible()
})
