import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InventoryExportsPage } from '../InventoryExportsPage'
import { InventoryImportPage } from '../InventoryImportPage'
import { ProductMediaGallery } from '../ProductMediaGallery'
import * as api from '../api'
import type { InventoryExportJob, InventoryImportJob } from '../api'

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  return {
    ...actual,
    fetchInventorySchema: vi.fn(),
    fetchInventoryImport: vi.fn(),
    fetchInventoryImports: vi.fn(),
    fetchInventoryExports: vi.fn(),
    uploadPrivateFile: vi.fn(),
    startInventoryImport: vi.fn(),
    previewInventoryImport: vi.fn(),
    confirmInventoryImport: vi.fn(),
    retryInventoryImport: vi.fn(),
    startInventoryExport: vi.fn(),
    attachProductMedia: vi.fn(),
    setPrimaryProductMedia: vi.fn(),
    removeProductMedia: vi.fn(),
  }
})

const mocked = vi.mocked(api)

function renderPage(ui: React.ReactElement, entry = '/app/inventario/importar') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

const importJob: InventoryImportJob = {
  id: 'import-1',
  status: 'awaiting_mapping',
  progress: 100,
  sourceFileName: 'productos.csv',
  headers: ['Nombre', 'Cantidad'],
  previewRows: [{ Nombre: 'Vela', Cantidad: '5' }],
  mapping: {},
  rowErrors: [],
  totalRows: 1,
  processedRows: 0,
  createdCount: 0,
  errorCount: 0,
  errorCode: '',
  reportUrl: null,
  createdAt: '2026-08-25T12:00:00Z',
  completedAt: null,
}

describe('Importación, exportación y fotos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.fetchInventorySchema.mockResolvedValue({
      inventoryId: 'inventory-1',
      name: 'Principal',
      lowStockThreshold: 5,
      maxActiveFields: 15,
      fields: [],
    })
    mocked.fetchInventoryImports.mockResolvedValue([])
    mocked.fetchInventoryExports.mockResolvedValue([])
  })

  it('sube, mapea, previsualiza y confirma una importación', async () => {
    const file = new File(['Nombre,Cantidad\nVela,5'], 'productos.csv', {
      type: 'text/csv',
    })
    mocked.uploadPrivateFile.mockResolvedValue('asset-1')
    mocked.startInventoryImport.mockResolvedValue({
      ...importJob,
      status: 'analysing',
      progress: 0,
      headers: [],
      previewRows: [],
    })
    mocked.fetchInventoryImport.mockResolvedValue(importJob)
    mocked.previewInventoryImport.mockResolvedValue(importJob)
    mocked.confirmInventoryImport.mockResolvedValue({
      ...importJob,
      status: 'queued',
      progress: 0,
    })

    renderPage(<InventoryImportPage />)
    await userEvent.upload(screen.getByLabelText('Archivo de inventario'), file)

    expect(await screen.findByText('Asocia las columnas')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre del producto (obligatorio)')).toHaveValue(
      'Nombre',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Previsualizar y validar' }))
    expect(
      await screen.findByText(
        'La muestra no presenta errores. Confirma para procesar todo el archivo.',
      ),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importación' }))

    expect(mocked.uploadPrivateFile).toHaveBeenCalledWith(
      file,
      'import_file',
      expect.any(Function),
    )
    expect(mocked.previewInventoryImport).toHaveBeenCalledWith('import-1', {
      name: 'Nombre',
      initialQuantity: 'Cantidad',
    })
    expect(mocked.confirmInventoryImport).toHaveBeenCalledWith(
      'import-1',
      expect.any(String),
    )
  })

  it('inicia una exportación con los filtros visibles', async () => {
    const created: InventoryExportJob = {
      id: 'export-1',
      status: 'queued',
      fileFormat: 'csv',
      progress: 0,
      rowCount: 0,
      errorCode: '',
      downloadUrl: null,
      expiresAt: null,
      createdAt: '2026-08-25T12:00:00Z',
      completedAt: null,
    }
    mocked.startInventoryExport.mockResolvedValue(created)
    renderPage(
      <InventoryExportsPage />,
      '/app/inventario/exportaciones?q=vela&stock=available&estado=active',
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Exportar CSV' }))

    await waitFor(() =>
      expect(mocked.startInventoryExport).toHaveBeenCalledWith({
        fileFormat: 'csv',
        filter: {
          search: 'vela',
          stockStates: ['available'],
          catalogStatuses: ['active'],
          includeArchived: false,
        },
        idempotencyKey: expect.any(String),
      }),
    )
  })

  it('carga una foto y la adjunta como principal sin usar el asistente', async () => {
    const file = new File(['image'], 'vela.webp', { type: 'image/webp' })
    mocked.uploadPrivateFile.mockImplementation(
      async (_file, _purpose, onProgress) => {
        onProgress?.(100)
        return 'asset-1'
      },
    )
    mocked.attachProductMedia.mockResolvedValue({
      assetId: 'asset-1',
      url: 'https://files.invalid/asset-1',
      contentType: 'image/webp',
      originalName: 'vela.webp',
      isPrimary: true,
      position: 1,
      createdAt: '2026-08-25T12:00:00Z',
    })

    renderPage(<ProductMediaGallery productId="product-1" media={[]} />)
    await userEvent.upload(screen.getByLabelText('Agregar foto'), file)

    await waitFor(() =>
      expect(mocked.attachProductMedia).toHaveBeenCalledWith(
        'product-1',
        'asset-1',
        true,
      ),
    )
    expect(mocked.uploadPrivateFile).toHaveBeenCalledWith(
      file,
      'product_image',
      expect.any(Function),
    )
  })
})
