import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'
import type { ReactElement } from 'react'

import ProductFormScreen from '../inventario/producto'
import { MobileApiError } from '../../../lib/auth-api'
import { NETWORK_UNAVAILABLE } from '../../../lib/graphql'
import * as api from '../../../lib/inventory-api'

jest.mock('../../../lib/inventory-api', () => ({
  ...jest.requireActual('../../../lib/inventory-api'),
  fetchInventorySchema: jest.fn(),
  fetchProductDetail: jest.fn(),
  fetchProducts: jest.fn(),
  createProduct: jest.fn(),
  createCustomField: jest.fn(),
  attachProductMedia: jest.fn(),
}))

jest.mock('../../../lib/mobile-upload', () => ({
  pickProductImage: jest.fn(),
  takeProductImage: jest.fn(),
  uploadProductImage: jest.fn(),
}))

const mockedParams = useLocalSearchParams as jest.Mock

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
    mockedParams.mockReturnValue({})
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

  it('tras crear vuelve al inventario', async () => {
    mocked.createProduct.mockResolvedValue({
      product: {
        id: 'product-1',
        name: 'Velas de soya',
        catalogStatus: 'active',
        purchasePrice: '2000',
        salePrice: '5000',
        currency: 'CLP',
        extraAttributes: {},
        lowStockThreshold: null,
        effectiveLowStockThreshold: 5,
        archivedAt: null,
        stock: { onHand: 12, reserved: 0, available: 12, activeFulfilment: 0 },
      },
      movement: null,
      replayed: false,
    } as Awaited<ReturnType<typeof api.createProduct>>)

    await renderScreen(<ProductFormScreen />)
    await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Velas de soya')
    await fireEvent.press(screen.getByRole('button', { name: 'Crear producto' }))

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/inventario')
    })
  })

  it('en editar muestra un botón para volver al inventario', async () => {
    mockedParams.mockReturnValue({ id: 'product-1' })
    mocked.fetchProductDetail.mockResolvedValue({
      product: {
        id: 'product-1',
        name: 'Velas de soya',
        catalogStatus: 'active',
        purchasePrice: '2000',
        salePrice: '5000',
        currency: 'CLP',
        extraAttributes: {},
        lowStockThreshold: null,
        effectiveLowStockThreshold: 5,
        archivedAt: null,
        createdAt: '2026-08-01T12:00:00Z',
        updatedAt: '',
        media: [],
        stock: { onHand: 12, reserved: 0, available: 12, activeFulfilment: 0 },
      },
      breakdown: {
        available: 12,
        totalCount: 0,
        pageInfo: { hasNextPage: false, endCursor: '' },
        lines: [],
      },
      orders: {
        totalCount: 0,
        availableFromStage: 'sales',
        nodes: [],
        pageInfo: { hasNextPage: false, endCursor: '' },
      },
      shipments: {
        totalCount: 0,
        nodes: [],
        pageInfo: { hasNextPage: false, endCursor: '' },
      },
    } as Awaited<ReturnType<typeof api.fetchProductDetail>>)

    await renderScreen(<ProductFormScreen />)

    expect(await screen.findByText('Editar producto')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Volver al inventario' }))
    expect(router.replace).toHaveBeenCalledWith('/inventario')
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

  it('muestra la cola de fotos en carga manual y no un asistente desactivado', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch')
    await renderScreen(<ProductFormScreen />)

    expect(screen.getByRole('button', { name: 'Elegir de la galería' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tomar foto' })).toBeOnTheScreen()
    expect(screen.queryByLabelText('Usar asistente con foto')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('en creación asistida no muestra el formulario hasta que hay una foto', async () => {
    mockedParams.mockReturnValue({ origen: 'asistida' })
    const fetchSpy = jest.spyOn(globalThis, 'fetch')
    await renderScreen(<ProductFormScreen />)

    expect(screen.getByText(/Sube o toma una foto para continuar/)).toBeOnTheScreen()
    expect(screen.queryByLabelText('Nombre')).toBeNull()
    expect(screen.getByRole('button', { name: 'Tomar foto' })).toBeOnTheScreen()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('bloquea una variante idéntica y no llama al API', async () => {
    mockedParams.mockReturnValue({ origen: 'variante' })
    mocked.fetchProducts.mockResolvedValue({
      totalCount: 1,
      hasNextPage: false,
      endCursor: '',
      products: [
        {
          id: 'product-1',
          name: 'Velas de soya',
          catalogStatus: 'active',
          purchasePrice: '2000',
          salePrice: '5000',
          currency: 'CLP',
          extraAttributes: {},
          lowStockThreshold: null,
          effectiveLowStockThreshold: 5,
          archivedAt: null,
          stock: { onHand: 12, reserved: 0, available: 12, activeFulfilment: 0 },
        },
      ],
    } as Awaited<ReturnType<typeof api.fetchProducts>>)

    await renderScreen(<ProductFormScreen />)
    await fireEvent.press(await screen.findByText('Velas de soya'))
    await fireEvent.press(screen.getByRole('button', { name: 'Crear producto' }))

    expect(
      (await screen.findAllByText(/Cambia al menos un dato respecto de Velas de soya/))
        .length,
    ).toBeGreaterThan(0)
    expect(mocked.createProduct).not.toHaveBeenCalled()
  })
})
