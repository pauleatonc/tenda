import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import type { ReactElement } from 'react'

import ShipmentDetailScreen from '../despachos/[shipmentId]'
import * as api from '../../../lib/shipping-api'

jest.mock('../../../lib/shipping-api', () => ({
  fetchShipment: jest.fn(),
  registerShipmentDispatch: jest.fn(),
  generateShipmentLabel: jest.fn(),
  shippingKeys: {
    root: ['shipping'],
    shipment: (id: string) => ['shipping', 'shipment', id],
  },
}))

const mocked = api as jest.Mocked<typeof api>
const mockedParams = useLocalSearchParams as jest.Mock

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function pendingShipment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ship-1',
    number: 'ENV-ABC',
    status: 'pending',
    statusLabel: 'Pendiente',
    deliveryMode: 'shipping',
    recipientName: 'Camila Soto',
    recipientTaxId: '11.111.111-1',
    commune: 'Ñuñoa',
    region: 'Región Metropolitana de Santiago',
    addressLine: 'Los Aromos 123',
    deliveryNotes: '',
    carrier: '',
    trackingCode: '',
    trackingUrl: '',
    dispatchNote: '',
    buyerEmail: 'camila@example.cl',
    allowedActions: { registerShipmentDispatch: true, generateShipmentLabel: true },
    createdAt: '2026-08-26T12:00:00Z',
    updatedAt: '2026-08-26T13:00:00Z',
    dispatchedAt: null as string | null,
    deliveredAt: null as string | null,
    latestLabel: null,
    order: { id: 'order-1', number: 'VEN-001', status: 'paid' },
    ...overrides,
  }
}

describe('Detalle de despacho mobile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedParams.mockReturnValue({ shipmentId: 'ship-1' })
  })

  it('registra el despacho con transportista y confirma el correo', async () => {
    const dispatched = pendingShipment({
      status: 'dispatched',
      statusLabel: 'Despachado',
      carrier: 'Chilexpress',
      trackingCode: 'CX-99',
      dispatchNote: 'Sale hoy',
      dispatchedAt: '2026-08-27T10:00:00Z',
      allowedActions: { registerShipmentDispatch: false, generateShipmentLabel: true },
    })
    let current: ReturnType<typeof pendingShipment> = pendingShipment()
    mocked.fetchShipment.mockImplementation(async () => current)
    mocked.registerShipmentDispatch.mockImplementation(async () => {
      current = dispatched
      return { replayed: false, shipment: dispatched }
    })

    await renderScreen(<ShipmentDetailScreen />)

    expect(await screen.findByText('Envío ENV-ABC')).toBeOnTheScreen()
    expect(
      screen.getByText('Al registrar, enviaremos un correo a camila@example.cl', {
        exact: false,
      }),
    ).toBeOnTheScreen()
    expect(screen.queryByText('Línea de tiempo')).toBeNull()
    expect(screen.queryByText('Cadencias')).toBeNull()
    expect(screen.queryByText('Compartir enlace público')).toBeNull()

    await fireEvent.changeText(screen.getByLabelText('Transportista'), 'Chilexpress')
    await fireEvent.changeText(screen.getByLabelText('Código de tracking (opcional)'), 'CX-99')
    await fireEvent.changeText(screen.getByLabelText('Nota para el comprador (opcional)'), 'Sale hoy')
    await fireEvent.press(screen.getByRole('button', { name: 'Registrar despacho' }))

    expect(await screen.findByText('Se enviará un correo a camila@example.cl.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar y notificar' }))

    await waitFor(() =>
      expect(mocked.registerShipmentDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          shipmentId: 'ship-1',
          carrier: 'Chilexpress',
          trackingCode: 'CX-99',
          trackingUrl: null,
          note: 'Sale hoy',
        }),
      ),
    )
    expect(
      await screen.findByText('Registrado. Enviamos el correo a camila@example.cl.'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Enviado a camila@example.cl')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Registrar despacho' })).toBeNull()
  })

  it('para retiro registra la entrega sin transportista', async () => {
    const pickup = pendingShipment({ deliveryMode: 'pickup', buyerEmail: '' })
    const delivered = {
      ...pickup,
      status: 'delivered',
      statusLabel: 'Entregado',
      deliveredAt: '2026-08-27T10:00:00Z',
      allowedActions: { registerShipmentDispatch: false, generateShipmentLabel: true },
    }
    let current: ReturnType<typeof pendingShipment> = pickup
    mocked.fetchShipment.mockImplementation(async () => current)
    mocked.registerShipmentDispatch.mockImplementation(async () => {
      current = delivered
      return { replayed: false, shipment: delivered }
    })

    await renderScreen(<ShipmentDetailScreen />)

    expect(await screen.findByRole('header', { name: 'Registrar entrega' })).toBeOnTheScreen()
    expect(screen.queryByLabelText('Transportista')).toBeNull()
    expect(
      screen.getByText('El comprador no dejó correo.', { exact: false }),
    ).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Registrar entrega' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Confirmar y notificar' }))

    await waitFor(() =>
      expect(mocked.registerShipmentDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ shipmentId: 'ship-1', carrier: null, note: null }),
      ),
    )
    expect(
      await screen.findByText('No se envió (sin correo registrado)'),
    ).toBeOnTheScreen()
    expect(screen.getAllByText('Entregado').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Registrar entrega' })).toBeNull()
  })
})
