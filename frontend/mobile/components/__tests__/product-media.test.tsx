import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { MobileProductMedia } from '../product-media'
import * as api from '../../lib/inventory-api'
import * as upload from '../../lib/mobile-upload'

jest.mock('../../lib/inventory-api', () => ({
  ...jest.requireActual('../../lib/inventory-api'),
  attachProductMedia: jest.fn(),
  setPrimaryProductMedia: jest.fn(),
  removeProductMedia: jest.fn(),
}))

jest.mock('../../lib/mobile-upload', () => ({
  pickProductImage: jest.fn(),
  uploadProductImage: jest.fn(),
}))

const mockedApi = api as jest.Mocked<typeof api>
const mockedUpload = upload as jest.Mocked<typeof upload>

describe('Fotos de producto en mobile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('elige, carga y adjunta la primera foto como principal', async () => {
    const image = {
      uri: 'file:///vela.webp',
      fileName: 'vela.webp',
      contentType: 'image/webp',
      size: 2048,
    }
    mockedUpload.pickProductImage.mockResolvedValue(image)
    mockedUpload.uploadProductImage.mockImplementation(async (_image, onProgress) => {
      onProgress?.(100)
      return 'asset-1'
    })
    mockedApi.attachProductMedia.mockResolvedValue({
      assetId: 'asset-1',
      url: 'https://files.invalid/asset-1',
      contentType: 'image/webp',
      originalName: 'vela.webp',
      isPrimary: true,
      position: 1,
      createdAt: '2026-08-25T12:00:00Z',
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    await render(
      <QueryClientProvider client={client}>
        <MobileProductMedia productId="product-1" media={[]} archived={false} />
      </QueryClientProvider>,
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar foto' }))

    await waitFor(() =>
      expect(mockedApi.attachProductMedia).toHaveBeenCalledWith(
        'product-1',
        'asset-1',
        true,
      ),
    )
    expect(mockedUpload.uploadProductImage).toHaveBeenCalledWith(
      image,
      expect.any(Function),
    )
  })

  it('no ofrece carga para un producto archivado', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await render(
      <QueryClientProvider client={client}>
        <MobileProductMedia productId="product-1" media={[]} archived />
      </QueryClientProvider>,
    )

    expect(screen.queryByRole('button', { name: 'Agregar foto' })).toBeNull()
  })
})
