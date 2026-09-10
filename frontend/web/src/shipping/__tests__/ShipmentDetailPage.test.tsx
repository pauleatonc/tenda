import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../api'
import { ShipmentDetailPage } from '../ShipmentDetailPage'

vi.mock('../api', () => ({
  fetchShipment: vi.fn(),
  updateShipment: vi.fn(),
  markShipmentDispatched: vi.fn(),
  generateShipmentLabel: vi.fn(),
  rescheduleFollowUp: vi.fn(),
  registerReturnCase: vi.fn(),
  confirmReturnToStock: vi.fn(),
  shippingKeys: {
    root: ['shipping'],
    shipment: (id: string) => ['shipping', 'shipment', id],
  },
}))

const mocked = vi.mocked(api)

const shipment = {
  id: 'ship-1',
  number: 'ENV-ABC',
  status: 'preparing',
  statusLabel: 'En preparación',
  deliveryMode: 'shipping',
  recipientName: 'Camila Soto',
  recipientTaxId: '11.111.111-1',
  commune: 'Ñuñoa',
  region: 'Región Metropolitana de Santiago',
  addressLine: 'Los Aromos 123',
  deliveryNotes: '',
  carrier: 'Chilexpress',
  trackingCode: 'CX-99',
  trackingUrl: 'https://chilexpress.cl/track/CX-99',
  nextAction: 'dispatch',
  allowedActions: {
    updateShipment: true,
    markShipmentDispatched: true,
    generateShipmentLabel: true,
    sendTicketMessage: false,
    resolveTicket: false,
    rescheduleFollowUp: false,
    registerReturnCase: false,
    confirmReturnToStock: false,
  },
  createdAt: '2026-08-26T12:00:00Z',
  updatedAt: '2026-08-26T13:00:00Z',
  dispatchedAt: null,
  deliveredAt: null,
  publicUrl: 'https://shop.example.test/s/public-token',
  confirmation: null,
  latestLabel: null,
  activeTicket: null,
  tickets: [],
  followUps: [],
  returnCases: [],
  nextFollowUp: null,
  order: { id: 'order-1', number: 'VEN-001', status: 'paid' },
  timeline: [
    {
      id: 'evt-1',
      eventType: 'shipment.updated',
      fromStatus: 'preparing',
      toStatus: 'preparing',
      title: 'Datos de seguimiento actualizados',
      detail: '',
      isPublic: false,
      actorName: 'ana@tenda.cl',
      createdAt: '2026-08-26T13:00:00Z',
    },
  ],
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
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('copia el tracking y advierte antes de abrir la URL externa', async () => {
    renderPage()
    expect(await screen.findByText('ENV-ABC', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Nota interna · ana@tenda.cl')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Copiar tracking' }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('CX-99'),
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Copiar enlace de seguimiento' }),
    )
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://shop.example.test/s/public-token',
      ),
    )
    expect(
      screen.getByRole('link', { name: 'Abrir seguimiento público' }),
    ).toHaveAttribute('href', 'https://shop.example.test/s/public-token')

    await userEvent.click(screen.getByRole('button', { name: 'Abrir seguimiento' }))
    expect(
      screen.getByText('Tenda no consulta el estado con el transportista', {
        exact: false,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Abrir sitio del transportista' }),
    ).toHaveAttribute('href', 'https://chilexpress.cl/track/CX-99')
  })

  it('oculta la edición cuando el envío ya fue despachado', async () => {
    mocked.fetchShipment.mockResolvedValue({
      ...shipment,
      status: 'dispatched',
      statusLabel: 'Despachado',
      allowedActions: {
        updateShipment: false,
        markShipmentDispatched: false,
        generateShipmentLabel: true,
        sendTicketMessage: false,
        resolveTicket: false,
        rescheduleFollowUp: true,
        registerReturnCase: true,
        confirmReturnToStock: false,
      },
    })
    renderPage()
    expect(await screen.findByText('Chilexpress')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar seguimiento' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Marcar despachado' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Generar etiqueta' })).toBeInTheDocument()
  })

  it('abre la vista previa de la etiqueta interna al generarla', async () => {
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
    expect(
      screen.getByText('Este documento no es una etiqueta de transportista', {
        exact: false,
      }),
    ).toBeInTheDocument()
    expect(screen.getByTitle('Vista previa de la etiqueta interna')).toHaveAttribute(
      'src',
      label.downloadUrl,
    )
    expect(screen.getByRole('link', { name: 'Descargar PDF' })).toHaveAttribute(
      'href',
      label.downloadUrl,
    )
  })

  it('muestra la cadencia y permite registrar una incidencia', async () => {
    mocked.fetchShipment.mockResolvedValue({
      ...shipment,
      status: 'dispatched',
      statusLabel: 'Despachado',
      nextFollowUp: {
        id: 'fu-1',
        kind: 'delivery_check',
        kindLabel: 'Chequeo de entrega',
        status: 'scheduled',
        statusLabel: 'Programado',
        dueAt: '2026-08-29T12:00:00Z',
        sentAt: null,
        parameterKey: 'shipping.delivery_check_hours',
        parameterSource: 'global',
        parameterSourceLabel: 'Parámetro global',
        parameterLabel: '72 h',
      },
      allowedActions: {
        ...shipment.allowedActions,
        updateShipment: false,
        markShipmentDispatched: false,
        rescheduleFollowUp: true,
        registerReturnCase: true,
      },
    })
    mocked.registerReturnCase.mockResolvedValue({
      replayed: false,
      shipment: {
        ...shipment,
        status: 'returned',
        returnCases: [
          {
            id: 'ret-1',
            kind: 'returned',
            kindLabel: 'Devolución',
            notes: '',
            stockConfirmedAt: null,
            createdAt: '2026-08-26T15:00:00Z',
          },
        ],
      },
    })
    renderPage()
    expect(
      await screen.findByText('Parámetro global', { exact: false }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reprogramar seguimiento' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Registrar un caso no repone stock', { exact: false }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar incidencia' }))
    await waitFor(() => expect(mocked.registerReturnCase).toHaveBeenCalled())
  })
})
