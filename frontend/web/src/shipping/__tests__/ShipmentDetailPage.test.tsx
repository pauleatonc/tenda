import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TendaApiError } from '../../lib/http'
import * as api from '../api'
import { ShipmentDetailPage } from '../ShipmentDetailPage'

vi.mock('../api', () => ({
  fetchShipment: vi.fn(),
  registerShipmentDispatch: vi.fn(),
  generateShipmentLabel: vi.fn(),
  shippingKeys: {
    root: ['shipping'],
    shipment: (id: string) => ['shipping', 'shipment', id],
  },
}))

const mocked = vi.mocked(api)

const shipment = {
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
  dispatchedAt: null,
  deliveredAt: null,
  latestLabel: null,
  order: { id: 'order-1', number: 'VEN-001', status: 'paid' },
}

const dispatched = {
  ...shipment,
  status: 'dispatched',
  statusLabel: 'Despachado',
  carrier: 'Chilexpress',
  trackingCode: 'CX-99',
  trackingUrl: 'https://chilexpress.cl/track/CX-99',
  dispatchNote: 'Sale hoy en la tarde',
  dispatchedAt: '2026-08-27T10:00:00Z',
  allowedActions: { registerShipmentDispatch: false, generateShipmentLabel: true },
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/despachos/ship-1']}>
        <Routes>
          <Route path="/app/despachos/:id" element={<ShipmentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('detalle de despacho', () => {
  beforeEach(() => {
    mocked.fetchShipment.mockResolvedValue(shipment)
    mocked.registerShipmentDispatch.mockReset()
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('registra el despacho con transportista y avisa el correo que se enviará', async () => {
    mocked.fetchShipment.mockResolvedValueOnce(shipment).mockResolvedValue(dispatched)
    mocked.registerShipmentDispatch.mockResolvedValue({ replayed: false, shipment: dispatched })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Registrar despacho' })).toBeInTheDocument()
    expect(
      screen.getByText(/Al registrar, enviaremos un correo a/),
    ).toHaveTextContent('camila@example.cl')
    expect(screen.queryByText('Línea de tiempo')).toBeNull()
    expect(screen.queryByText('Cadencias')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copiar enlace de seguimiento' })).toBeNull()

    const submit = screen.getByRole('button', { name: 'Registrar despacho' })
    expect(submit).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Transportista'), 'Chilexpress')
    await userEvent.type(screen.getByLabelText('Código de tracking (opcional)'), 'CX-99')
    await userEvent.type(
      screen.getByLabelText('URL de seguimiento (opcional)'),
      'https://chilexpress.cl/track/CX-99',
    )
    await userEvent.type(
      screen.getByLabelText('Nota para el comprador (opcional)'),
      'Sale hoy en la tarde',
    )
    expect(submit).toBeEnabled()
    await userEvent.click(submit)

    expect(await screen.findByText('Se enviará un correo a camila@example.cl.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar y notificar' }))

    await waitFor(() =>
      expect(mocked.registerShipmentDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          shipmentId: 'ship-1',
          carrier: 'Chilexpress',
          trackingCode: 'CX-99',
          trackingUrl: 'https://chilexpress.cl/track/CX-99',
          note: 'Sale hoy en la tarde',
        }),
      ),
    )
    expect(await screen.findByRole('heading', { name: 'Despachado' })).toBeInTheDocument()
    expect(screen.getByText('Enviado a camila@example.cl')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar despacho' })).toBeNull()
  })

  it('para retiro registra la entrega sin pedir transportista', async () => {
    const pickup = { ...shipment, deliveryMode: 'pickup', buyerEmail: '' }
    const delivered = {
      ...pickup,
      status: 'delivered',
      statusLabel: 'Entregado',
      deliveredAt: '2026-08-27T10:00:00Z',
      allowedActions: { registerShipmentDispatch: false, generateShipmentLabel: true },
    }
    mocked.fetchShipment.mockResolvedValueOnce(pickup).mockResolvedValue(delivered)
    mocked.registerShipmentDispatch.mockResolvedValue({ replayed: false, shipment: delivered })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Registrar entrega' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Transportista')).toBeNull()
    expect(screen.getByText('El comprador no dejó correo.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar y notificar' }))

    await waitFor(() =>
      expect(mocked.registerShipmentDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ shipmentId: 'ship-1', carrier: null, note: null }),
      ),
    )
    expect(await screen.findByRole('heading', { name: 'Entregado' })).toBeInTheDocument()
    expect(screen.getByText('No se envió (sin correo registrado)')).toBeInTheDocument()
  })

  it('muestra el error de campo cuando el backend rechaza el transportista', async () => {
    mocked.registerShipmentDispatch.mockRejectedValue(
      new TendaApiError(
        {
          code: 'VALIDATION_ERROR',
          message: 'Revisa los datos.',
          fieldErrors: { carrier: ['Indica el transportista.'] },
          correlationId: 'c-1',
        },
        400,
      ),
    )
    renderPage()
    await userEvent.type(await screen.findByLabelText('Transportista'), 'X')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar despacho' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar y notificar' }))
    expect(await screen.findByText('Indica el transportista.')).toBeInTheDocument()
    expect(screen.getByLabelText('Transportista')).toHaveAttribute('aria-invalid', 'true')
  })

  it('muestra el registro en solo lectura cuando ya fue despachado', async () => {
    mocked.fetchShipment.mockResolvedValue(dispatched)
    renderPage()
    expect(await screen.findByText('Chilexpress')).toBeInTheDocument()
    expect(screen.getByText('Sale hoy en la tarde')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar despacho' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Abrir seguimiento' })).toBeNull()
    expect(screen.getByText('CX-99')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Copiar tracking' }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('CX-99'),
    )
    expect(screen.getByRole('button', { name: 'Generar etiqueta' })).toBeInTheDocument()
  })

  it('abre el modal de descarga de la etiqueta interna al generarla', async () => {
    const label = {
      id: 'lab-1',
      downloadUrl: 'https://r2.invalid/download/label.pdf?expires=300',
      expiresAt: '2026-08-27T12:00:00Z',
      createdAt: '2026-08-26T14:00:00Z',
      fileName: 'etiqueta-interna-ENV-ABC.pdf',
    }
    mocked.generateShipmentLabel.mockResolvedValue({
      replayed: false,
      label,
      shipment: { ...shipment, latestLabel: label },
    })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Generar etiqueta' }))
    expect(
      await screen.findByRole('heading', { name: 'Etiqueta interna Tenda' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/etiqueta-interna-ENV-ABC\.pdf/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Descargar PDF' })).toHaveAttribute(
      'href',
      label.downloadUrl,
    )
  })
})
