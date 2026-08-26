import {
  AttachProductMediaDocument,
  ArchiveProductDocument,
  CreateCustomFieldDocument,
  CreateProductDocument,
  InventoryDashboardDocument,
  InventoryExportsDocument,
  InventoryImportsDocument,
  InventorySchemaDocument,
  ProductBreakdownDocument,
  ProductDetailDocument,
  ProductMovementsDocument,
  ProductsDocument,
  RecordStockMovementDocument,
  RemoveProductMediaDocument,
  RestoreProductDocument,
  SetPrimaryProductMediaDocument,
  UpdateProductDocument,
  type OperationCreateCustomFieldInput,
  type OperationCreateProductInput,
  type OperationCustomFieldDefinitionFragment,
  type OperationInventoryExportJobFragment,
  type OperationInventoryImportJobFragment,
  type OperationProductDetailQuery,
  type OperationProductFilterInput,
  type OperationProductMediaFragment,
  type OperationProductRowFragment,
  type OperationRecordStockMovementInput,
  type OperationStockMovementRowFragment,
  type OperationUpdateProductInput,
} from '@tenda/api-client'

import { graphqlRequest } from './graphql'

export type CustomField = OperationCustomFieldDefinitionFragment
export type StockMovement = OperationStockMovementRowFragment
export type ProductMedia = Omit<OperationProductMediaFragment, 'createdAt'> & {
  createdAt: string
}
export type ProductCard = Omit<OperationProductRowFragment, 'extraAttributes'> & {
  extraAttributes: Record<string, unknown>
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/** `JSONString` travels as text, so the boundary parses it exactly once. */
function parseAttributes(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || !value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function toProductCard(product: OperationProductRowFragment): ProductCard {
  return { ...product, extraAttributes: parseAttributes(product.extraAttributes) }
}

export type ProductPage = {
  totalCount: number
  hasNextPage: boolean
  endCursor: string
  products: ProductCard[]
}

export async function fetchProducts(variables: {
  filter?: OperationProductFilterInput
  sort?: string
  descending?: boolean
  first?: number
  after?: string | null
}): Promise<ProductPage> {
  const data = await graphqlRequest(ProductsDocument, {
    filter: variables.filter ?? null,
    sort: variables.sort ?? 'name',
    descending: variables.descending ?? false,
    first: variables.first ?? 20,
    after: variables.after ?? null,
  })
  return {
    totalCount: data.products.totalCount,
    hasNextPage: data.products.pageInfo.hasNextPage,
    endCursor: data.products.pageInfo.endCursor,
    products: data.products.nodes.map(toProductCard),
  }
}

export async function fetchInventorySchema(includeInactive = false) {
  const data = await graphqlRequest(InventorySchemaDocument, { includeInactive })
  return data.inventorySchema
}

export async function fetchDashboard() {
  const data = await graphqlRequest(InventoryDashboardDocument, {})
  return data.inventoryDashboard
}

export type ProductDetail = {
  product: ProductCard & {
    createdAt: string
    updatedAt: string
    media: ProductMedia[]
  }
  breakdown: OperationProductDetailQuery['productStockBreakdown']
  orders: OperationProductDetailQuery['productOrders']
  shipments: OperationProductDetailQuery['productShipments']
}

export async function fetchProductDetail(id: string): Promise<ProductDetail | null> {
  const data = await graphqlRequest(ProductDetailDocument, { id })
  if (!data.product) return null
  return {
    product: {
      ...toProductCard(data.product),
      createdAt: String(data.product.createdAt),
      updatedAt: String(data.product.updatedAt),
      media: data.product.media.map((media) => ({
        ...media,
        createdAt: String(media.createdAt),
      })),
    },
    breakdown: data.productStockBreakdown,
    orders: data.productOrders,
    shipments: data.productShipments,
  }
}

export async function fetchProductBreakdown(productId: string) {
  const data = await graphqlRequest(ProductBreakdownDocument, {
    productId,
    first: 10,
    after: null,
  })
  return data.productStockBreakdown
}

export async function fetchProductMovements(productId: string) {
  const data = await graphqlRequest(ProductMovementsDocument, {
    productId,
    first: 20,
    after: null,
  })
  return data.stockMovements
}

export async function createProduct(
  input: Omit<OperationCreateProductInput, 'extraAttributes'> & {
    extraAttributes?: Record<string, unknown>
  },
) {
  const data = await graphqlRequest(CreateProductDocument, {
    input: { ...input, extraAttributes: JSON.stringify(input.extraAttributes ?? {}) },
  })
  return {
    product: toProductCard(data.createProduct.product),
    movement: data.createProduct.movement ?? null,
    replayed: data.createProduct.replayed,
  }
}

export async function updateProduct(
  input: Omit<OperationUpdateProductInput, 'extraAttributes'> & {
    extraAttributes?: Record<string, unknown>
  },
) {
  const data = await graphqlRequest(UpdateProductDocument, {
    input: {
      ...input,
      extraAttributes: input.extraAttributes
        ? JSON.stringify(input.extraAttributes)
        : null,
    },
  })
  return toProductCard(data.updateProduct.product)
}

export async function recordStockMovement(input: OperationRecordStockMovementInput) {
  const data = await graphqlRequest(RecordStockMovementDocument, { input })
  return {
    movement: data.recordStockMovement.movement,
    product: toProductCard(data.recordStockMovement.product),
    replayed: data.recordStockMovement.replayed,
  }
}

export async function archiveProduct(productId: string) {
  const data = await graphqlRequest(ArchiveProductDocument, { productId })
  return toProductCard(data.archiveProduct.product)
}

export async function restoreProduct(productId: string) {
  const data = await graphqlRequest(RestoreProductDocument, { productId })
  return toProductCard(data.restoreProduct.product)
}

export async function createCustomField(input: OperationCreateCustomFieldInput) {
  const data = await graphqlRequest(CreateCustomFieldDocument, { input })
  return data.createCustomField.field
}

export async function attachProductMedia(
  productId: string,
  assetId: string,
  makePrimary = false,
) {
  const data = await graphqlRequest(AttachProductMediaDocument, {
    productId,
    assetId,
    makePrimary,
  })
  return data.attachProductMedia.media
}

export async function setPrimaryProductMedia(productId: string, assetId: string) {
  const data = await graphqlRequest(SetPrimaryProductMediaDocument, {
    productId,
    assetId,
  })
  return data.setPrimaryProductMedia.media
}

export async function removeProductMedia(productId: string, assetId: string) {
  const data = await graphqlRequest(RemoveProductMediaDocument, { productId, assetId })
  return toProductCard(data.removeProductMedia.product)
}

export type MobileImportJob = Omit<
  OperationInventoryImportJobFragment,
  'headers' | 'previewRows' | 'mapping' | 'rowErrors' | 'createdAt' | 'completedAt'
> & {
  rowErrors: { row: number; code: string; message: string }[]
  createdAt: string
  completedAt: string | null
}

function toImportJob(job: OperationInventoryImportJobFragment): MobileImportJob {
  return {
    ...job,
    rowErrors: parseJson(job.rowErrors, []),
    createdAt: String(job.createdAt),
    completedAt: job.completedAt ? String(job.completedAt) : null,
  }
}

export type MobileExportJob = Omit<
  OperationInventoryExportJobFragment,
  'createdAt' | 'completedAt' | 'expiresAt'
> & {
  createdAt: string
  completedAt: string | null
  expiresAt: string | null
}

function toExportJob(job: OperationInventoryExportJobFragment): MobileExportJob {
  return {
    ...job,
    createdAt: String(job.createdAt),
    completedAt: job.completedAt ? String(job.completedAt) : null,
    expiresAt: job.expiresAt ? String(job.expiresAt) : null,
  }
}

export async function fetchInventoryImports(): Promise<MobileImportJob[]> {
  const data = await graphqlRequest(InventoryImportsDocument, {})
  return data.inventoryImports.map(toImportJob)
}

export async function fetchInventoryExports(): Promise<MobileExportJob[]> {
  const data = await graphqlRequest(InventoryExportsDocument, {})
  return data.inventoryExports.map(toExportJob)
}

export const inventoryKeys = {
  schema: () => ['inventory', 'schema'] as const,
  dashboard: () => ['inventory', 'dashboard'] as const,
  products: (variables: Record<string, unknown>) =>
    ['inventory', 'products', variables] as const,
  product: (id: string) => ['inventory', 'product', id] as const,
  movements: (id: string) => ['inventory', 'movements', id] as const,
  breakdown: (id: string) => ['inventory', 'breakdown', id] as const,
  jobs: () => ['inventory', 'jobs'] as const,
}
