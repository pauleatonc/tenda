import { expect, test } from '@playwright/test'

import {
  approveProofAndRegisterDispatch,
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

test('login → inventario → venta → pago → balance → registro de despacho', async ({
  page,
}) => {
  const productName = `Vela E2E ${Date.now()}`
  await loginAsOwner(page)
  await createCatalogProduct(page, productName)
  const orderUrl = await publishShippingSale(page, productName)
  await completeBankTransferPurchase(page, orderUrl)
  await approveProofAndRegisterDispatch(page)

  await page.goto('/app/despachos')
  await expect(page.getByRole('heading', { name: 'Despachos' })).toBeVisible()
  await expect(page.getByText('Chilexpress · CX-E2E-01')).toBeVisible()
  await expect(page.getByText('Vencimiento')).toHaveCount(0)
  await expect(page.getByText('Próxima acción')).toHaveCount(0)
})
