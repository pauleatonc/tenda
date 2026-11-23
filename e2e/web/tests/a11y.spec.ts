import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { loginAsOwner, prepareE2eOwner } from './helpers'

async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const blocking = results.violations.filter((violation) =>
    ['critical', 'serious'].includes(violation.impact ?? ''),
  )
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
}

test.beforeAll(() => {
  prepareE2eOwner()
})

test('axe WCAG en landing, login, inventario y Cuenta', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: /Inventario, venta y despacho/ }),
  ).toBeVisible()
  await expectNoSeriousAxeViolations(page)

  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible()
  await expectNoSeriousAxeViolations(page)

  await loginAsOwner(page)
  await page.getByRole('link', { name: 'Inventario', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Inventario', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('link', { name: /Agregar producto|Crear producto/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: 'Agregar producto' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Carga manual' })).toBeVisible()
  await expectNoSeriousAxeViolations(page)

  await page.getByRole('button', { name: 'Cuenta', exact: true }).click()
  await expect(
    page.getByRole('link', { name: 'Perfil empresa', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Plan', exact: true })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Integración de pago', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Cuentas bancarias', exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Perfil empresa', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Perfil empresa', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Asistente con foto')).toHaveCount(0)
  await expectNoSeriousAxeViolations(page)
})
