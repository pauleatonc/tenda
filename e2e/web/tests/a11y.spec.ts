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

test('axe WCAG en landing, login, inventario y el anuncio del agente', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Menos planillas/ })).toBeVisible()
  await expectNoSeriousAxeViolations(page)

  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible()
  await expectNoSeriousAxeViolations(page)

  await loginAsOwner(page)
  await page.getByRole('link', { name: 'Inventario', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Agregar con asistente' })).toBeDisabled()
  await expectNoSeriousAxeViolations(page)

  await page.getByRole('link', { name: 'Más', exact: true }).click()
  await expect(page.getByText('Asistente con foto')).toBeVisible()
  await expect(page.getByText('Próximamente')).toBeVisible()
  await expectNoSeriousAxeViolations(page)
})
