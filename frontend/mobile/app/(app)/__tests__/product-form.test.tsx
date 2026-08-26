import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import type { ReactElement } from 'react'

import ProductFormScreen from '../inventario/producto'
import { MobileApiError } from '../../../lib/auth-api'
import { NETWORK_UNAVAILABLE } from '../../../lib/graphql'
import * as api from '../../../lib/inventory-api'

jest.mock('../../../lib/inventory-api', () => ({
  ...jest.requireActual('../../../lib/inventory-api'),
  fetchInventorySchema: jest.fn(),
  fetchProductDetail: jest.fn(),
  createProduct: jest.fn(),
  createCustomField: jest.fn(),
}))

const mocked = api as jest.Mocked<typeof api>

const emptySchema = {
  inventoryId: 'inv-1',
  name: 'Inventario principal',
  lowStockThreshold: 5,
  maxActiveFields: 15,
  fields: [],
}

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('Crear producto en mobile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocked.fetchInventorySchema.mockResolvedValue(
      emptySchema as Awaited<ReturnType<typeof api.fetchInventorySchema>>,
    )
  })

  it('valida el nombre antes de llamar al backend', async () => {
    await renderScreen(<ProductFormScreen />)

    await fireEvent.press(screen.getByRole('button', { name: 'Crear producto' }))

    expect(await screen.findByText('Revisa estos datos')).toBeOnTheScreen()
    expect(screen.getAllByText('Escribe el nombre del producto.').length).toBeGreaterThan(
      0,
    )
    expect(mocked.createProduct).not.toHaveBeenCalled()
  })

  it('rechaza montos con decimales sin enviar la mutación', async () => {
    await renderScreen(<ProductFormScreen />)

    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Velas de soya')
    await fireEvent.changeText(screen.getByLabelText('Precio de venta'), '1500,5')
    await fireEvent.press(screen.getByRole('button', { name: 'Crear producto' }))

    expect(
      (await screen.findAllByText('Usa un monto entero en pesos, sin decimales.')).length,
    ).toBeGreaterThan(0)
    expect(mocked.createProduct).not.toHaveBeenCalled()
  })

  it('sin red bloquea el envío, conserva el borrador y no encola la mutación', async () => {
    mocked.createProduct.mockRejectedValue(
      new MobileApiError({
        code: NETWORK_UNAVAILABLE,
        message: 'Sin conexión. No enviamos nada; tus datos siguen en pantalla.',
        fieldErrors: {},
        correlationId: '',
        retryable: true,
      }),
    )

    await renderScreen(<ProductFormScreen />)

    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Velas de soya')
    await fireEvent.changeText(screen.getByLabelText('Cantidad inicial'), '12')
    await fireEvent.press(screen.getByRole('button', { name: 'Crear producto' }))

    expect(
      await screen.findByText(
        'Sin conexión. No enviamos nada; tus datos siguen en pantalla.',
      ),
    ).toBeOnTheScreen()
    // The draft is still on screen and nothing was navigated to or queued.
    expect(screen.getByLabelText('Nombre')).toHaveDisplayValue('Velas de soya')
    expect(screen.getByLabelText('Cantidad inicial')).toHaveDisplayValue('12')
    expect(router.replace).not.toHaveBeenCalled()
    expect(mocked.createProduct).toHaveBeenCalledTimes(1)
  })

  it('crear una columna conserva lo ya escrito y suma el campo nuevo', async () => {
    mocked.createCustomField.mockResolvedValue({
      id: 'field-1',
      key: 'aroma',
      label: 'Aroma',
      fieldType: 'short_text',
      helpText: '',
      isRequired: false,
      isVisible: true,
      isFilterable: false,
      isActive: true,
      position: 1,
      options: [],
    } as Awaited<ReturnType<typeof api.createCustomField>>)

    await renderScreen(<ProductFormScreen />)

    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Velas de soya')
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar columna' }))

    await fireEvent.changeText(await screen.findByLabelText('Etiqueta'), 'Aroma')
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar columna' }))

    await waitFor(() => {
      expect(mocked.createCustomField).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Aroma', fieldType: 'short_text' }),
        expect.anything(),
      )
    })
    expect(screen.getByLabelText('Nombre')).toHaveDisplayValue('Velas de soya')
  })

  it('mantiene el asistente con foto desactivado y sin peticiones', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch')

    await renderScreen(<ProductFormScreen />)

    const assistant = screen.getByLabelText('Usar asistente con foto')
    expect(assistant).toBeDisabled()
    expect(
      screen.getByText('Próximamente: el asistente con foto aún no está disponible.'),
    ).toBeOnTheScreen()

    await fireEvent.press(assistant)

    expect(router.push).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
