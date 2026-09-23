import {
  AttachProductMediaDocument,
  ArchiveProductDocument,
  ConfirmInventoryImportDocument,
  CreateCustomFieldDocument,
  CreateProductDocument,
  InventoryDashboardDocument,
  InventoryExportsDocument,
  InventoryImportDocument,
  InventoryImportsDocument,
  InventoryImportTemplateDocument,
  InventorySchemaDocument,
  PreviewInventoryImportDocument,
  ProductBreakdownDocument,
  ProductDetailDocument,
  ProductMovementsDocument,
  ProductsDocument,
  RecordStockMovementDocument,
  RemoveProductMediaDocument,
  ReorderCustomFieldsDocument,
  RestoreProductDocument,
  RetryInventoryExportDocument,
  RetryInventoryImportDocument,
  SetPrimaryProductMediaDocument,
  StartInventoryExportDocument,
  StartInventoryImportDocument,
  UpdateCustomFieldDocument,
  UpdateInventoryLowStockThresholdDocument,
  UpdateProductDocument,
  UpdateProductLowStockThresholdDocument,
  type OperationCreateCustomFieldInput,
  type OperationCreateProductInput,
  type OperationCustomFieldDefinitionFragment,
  type OperationInventoryAlertFragment,
  type OperationInventoryExportJobFragment,
  type OperationInventoryImportJobFragment,
  type OperationInventoryImportTemplateQuery,
  type OperationProductDetailQuery,
  type OperationProductFilterInput,
  type OperationProductMediaFragment,
  type OperationProductRowFragment,
  type OperationProductsQuery,
  type OperationRecordStockMovementInput,
  type OperationUpdateCustomFieldInput,
  type OperationUpdateProductInput,
} from '@tenda/api-client'

import { graphqlRequest, request, uploadBinary } from '../lib/http'

export type CustomField = OperationCustomFieldDefinitionFragment
export type ProductMedia = Omit<OperationProductMediaFragment, 'createdAt'> & {
  createdAt: string
}
type InventoryAlert = Omit<
  OperationInventoryAlertFragment,
  'openedAt' | 'updatedAt'
> & {
  openedAt: string
  updatedAt: string
}
export type ProductRow = Omit<OperationProductRowFragment, 'extraAttributes'> & {
  extraAttributes: Record<string, unknown>
}

/** `JSONString` travels as text, so the boundary parses it exactly once. */
function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed as T
  } catch {
    return fallback
  }
}

function parseAttributes(value: unknown): Record<string, unknown> {
  const parsed = parseJson<unknown>(value, {})
  return typeof parsed === 'object' && parsed !== null
    ? (parsed as Record<string, unknown>)
    : {}
}

function toProductRow(product: OperationProductRowFragment): ProductRow {
  return { ...product, extraAttributes: parseAttributes(product.extraAttributes) }
}

type ImportRowError = {
  row: number
  code: string
  message: string
  fieldErrors: Record<string, string[]>
}

export type InventoryImportJob = Omit<
  OperationInventoryImportJobFragment,
  'headers' | 'previewRows' | 'mapping' | 'rowErrors' | 'createdAt' | 'completedAt'
> & {
  headers: string[]
  previewRows: Record<string, unknown>[]
  mapping: Record<string, string>
  rowErrors: ImportRowError[]
  createdAt: string
  completedAt: string | null
}

function toImportJob(job: OperationInventoryImportJobFragment): InventoryImportJob {
  return {
    ...job,
    headers: parseJson<string[]>(job.headers, []),
    previewRows: parseJson<Record<string, unknown>[]>(job.previewRows, []),
    mapping: parseJson<Record<string, string>>(job.mapping, {}),
    rowErrors: parseJson<ImportRowError[]>(job.rowErrors, []),
    createdAt: String(job.createdAt),
    completedAt: job.completedAt ? String(job.completedAt) : null,
  }
}

export type InventoryExportJob = Omit<
  OperationInventoryExportJobFragment,
  'createdAt' | 'completedAt' | 'expiresAt'
> & {
  createdAt: string
  completedAt: string | null
  expiresAt: string | null
}

function toExportJob(job: OperationInventoryExportJobFragment): InventoryExportJob {
  return {
    ...job,
    createdAt: String(job.createdAt),
    completedAt: job.completedAt ? String(job.completedAt) : null,
    expiresAt: job.expiresAt ? String(job.expiresAt) : null,
  }
}

function toAlert(alert: OperationInventoryAlertFragment): InventoryAlert {
  return {
    ...alert,
    openedAt: String(alert.openedAt),
    updatedAt: String(alert.updatedAt),
  }
}

export type ProductPage = {
  totalCount: number
  hasNextPage: boolean
  endCursor: string
  products: ProductRow[]
}

export async function fetchProducts(variables: {
  filter?: OperationProductFilterInput
  sort?: string
  descending?: boolean
  first?: number
  after?: string | null
}): Promise<ProductPage> {
  const data: OperationProductsQuery = await graphqlRequest(ProductsDocument, {
    filter: variables.filter ?? null,
    sort: variables.sort ?? 'name',
    descending: variables.descending ?? false,
    first: variables.first ?? 25,
    after: variables.after ?? null,
  })
  return {
    totalCount: data.products.totalCount,
    hasNextPage: data.products.pageInfo.hasNextPage,
    endCursor: data.products.pageInfo.endCursor,
    products: data.products.nodes.map(toProductRow),
  }
}

export async function fetchInventorySchema(includeInactive = false) {
  const data = await graphqlRequest(InventorySchemaDocument, { includeInactive })
  return data.inventorySchema
}

export async function fetchDashboard() {
  const data = await graphqlRequest(InventoryDashboardDocument, {})
  return {
    ...data.inventoryDashboard,
    alerts: data.inventoryDashboard.alerts.map(toAlert),
  }
}

export type ProductDetail = {
  product: ProductRow & {
    createdAt: string
    updatedAt: string
    media: ProductMedia[]
  }
  breakdown: OperationProductDetailQuery['productStockBreakdown']
  orders: OperationProductDetailQuery['productOrders']
  shipments: OperationProductDetailQuery['productShipments']
}

export async function fetchProductDetail(id: string): Promise<ProductDetail | null> {
  const data: OperationProductDetailQuery = await graphqlRequest(ProductDetailDocument, {
    id,
  })
  if (!data.product) return null
  return {
    product: {
      ...toProductRow(data.product),
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

export async function fetchProductBreakdown(
  productId: string,
  after: string | null = null,
) {
  const data = await graphqlRequest(ProductBreakdownDocument, {
    productId,
    first: 10,
    after,
  })
  return data.productStockBreakdown
}

export async function fetchProductMovements(variables: {
  productId: string
  first?: number
  after?: string | null
}) {
  const data = await graphqlRequest(ProductMovementsDocument, {
    productId: variables.productId,
    first: variables.first ?? 20,
    after: variables.after ?? null,
  })
  return data.stockMovements
}

export async function createProduct(
  input: Omit<OperationCreateProductInput, 'extraAttributes'> & {
    extraAttributes?: Record<string, unknown>
  },
) {
  const data = await graphqlRequest(CreateProductDocument, {
    input: {
      ...input,
      extraAttributes: JSON.stringify(input.extraAttributes ?? {}),
    },
  })
  return {
    product: toProductRow(data.createProduct.product),
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
  return toProductRow(data.updateProduct.product)
}

export async function recordStockMovement(input: OperationRecordStockMovementInput) {
  const data = await graphqlRequest(RecordStockMovementDocument, { input })
  return {
    movement: data.recordStockMovement.movement,
    product: toProductRow(data.recordStockMovement.product),
    replayed: data.recordStockMovement.replayed,
  }
}

export async function archiveProduct(productId: string) {
  const data = await graphqlRequest(ArchiveProductDocument, { productId })
  return toProductRow(data.archiveProduct.product)
}

export async function restoreProduct(productId: string) {
  const data = await graphqlRequest(RestoreProductDocument, { productId })
  return toProductRow(data.restoreProduct.product)
}

export async function createCustomField(input: OperationCreateCustomFieldInput) {
  const data = await graphqlRequest(CreateCustomFieldDocument, { input })
  return data.createCustomField.field
}

export async function updateCustomField(input: OperationUpdateCustomFieldInput) {
  const data = await graphqlRequest(UpdateCustomFieldDocument, { input })
  return data.updateCustomField.field
}

export async function reorderCustomFields(fieldIds: string[]) {
  const data = await graphqlRequest(ReorderCustomFieldsDocument, { fieldIds })
  return data.reorderCustomFields.fields
}

export async function uploadPrivateFile(
  file: File,
  purpose: 'product_image' | 'import_file' | 'profile_photo' | 'organisation_logo',
  onProgress?: (percentage: number) => void,
): Promise<string> {
  const prepared = await request<{
    assetId: string
    uploadUrl: string
    headers: Record<string, string>
    expiresIn: number
  }>('/api/v1/media/uploads/prepare', {
    method: 'POST',
    body: JSON.stringify({
      purpose,
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  })
  await uploadBinary(prepared.uploadUrl, file, prepared.headers, onProgress)
  const completed = await request<{ assetId: string; status: string }>(
    '/api/v1/media/uploads/complete',
    {
      method: 'POST',
      body: JSON.stringify({ assetId: prepared.assetId }),
    },
  )
  return completed.assetId
}

export async function attachProductMedia(
  productId: string,
  assetId: string,
  makePrimary = false,
): Promise<ProductMedia> {
  const data = await graphqlRequest(AttachProductMediaDocument, {
    productId,
    assetId,
    makePrimary,
  })
  return {
    ...data.attachProductMedia.media,
    createdAt: String(data.attachProductMedia.media.createdAt),
  }
}

export async function setPrimaryProductMedia(productId: string, assetId: string) {
  const data = await graphqlRequest(SetPrimaryProductMediaDocument, {
    productId,
    assetId,
  })
  return {
    ...data.setPrimaryProductMedia.media,
    createdAt: String(data.setPrimaryProductMedia.media.createdAt),
  }
}

export async function removeProductMedia(productId: string, assetId: string) {
  const data = await graphqlRequest(RemoveProductMediaDocument, { productId, assetId })
  return toProductRow(data.removeProductMedia.product)
}

export async function startInventoryImport(assetId: string): Promise<InventoryImportJob> {
  const data = await graphqlRequest(StartInventoryImportDocument, { assetId })
  return toImportJob(data.startInventoryImport.importJob)
}

export async function previewInventoryImport(
  importId: string,
  mapping: Record<string, string>,
): Promise<InventoryImportJob> {
  const data = await graphqlRequest(PreviewInventoryImportDocument, {
    importId,
    mapping: JSON.stringify(mapping),
  })
  return toImportJob(data.previewInventoryImport.importJob)
}

export async function confirmInventoryImport(
  importId: string,
  idempotencyKey: string,
): Promise<InventoryImportJob> {
  const data = await graphqlRequest(ConfirmInventoryImportDocument, {
    importId,
    idempotencyKey,
  })
  return toImportJob(data.confirmInventoryImport.importJob)
}

export async function retryInventoryImport(importId: string): Promise<InventoryImportJob> {
  const data = await graphqlRequest(RetryInventoryImportDocument, { importId })
  return toImportJob(data.retryInventoryImport.importJob)
}

export async function fetchInventoryImport(id: string): Promise<InventoryImportJob | null> {
  const data = await graphqlRequest(InventoryImportDocument, { id })
  return data.inventoryImport ? toImportJob(data.inventoryImport) : null
}

export async function fetchInventoryImports(): Promise<InventoryImportJob[]> {
  const data = await graphqlRequest(InventoryImportsDocument, {})
  return data.inventoryImports.map(toImportJob)
}

export type InventoryImportTemplate =
  OperationInventoryImportTemplateQuery['inventoryImportTemplate']

export async function fetchInventoryImportTemplate(): Promise<InventoryImportTemplate> {
  const data = await graphqlRequest(InventoryImportTemplateDocument, {})
  return data.inventoryImportTemplate
}

export async function startInventoryExport(input: {
  fileFormat: 'csv' | 'xlsx'
  filter?: OperationProductFilterInput
  idempotencyKey: string
}): Promise<InventoryExportJob> {
  const data = await graphqlRequest(StartInventoryExportDocument, {
    fileFormat: input.fileFormat,
    filter: input.filter ?? null,
    idempotencyKey: input.idempotencyKey,
  })
  return toExportJob(data.startInventoryExport.exportJob)
}

export async function fetchInventoryExports(): Promise<InventoryExportJob[]> {
  const data = await graphqlRequest(InventoryExportsDocument, {})
  return data.inventoryExports.map(toExportJob)
}

export async function retryInventoryExport(exportId: string): Promise<InventoryExportJob> {
  const data = await graphqlRequest(RetryInventoryExportDocument, { exportId })
  return toExportJob(data.retryInventoryExport.exportJob)
}

export async function updateInventoryLowStockThreshold(threshold: number): Promise<number> {
  const data = await graphqlRequest(UpdateInventoryLowStockThresholdDocument, {
    threshold,
  })
  return data.updateInventoryLowStockThreshold.threshold
}

export async function updateProductLowStockThreshold(
  productId: string,
  threshold: number | null,
) {
  const data = await graphqlRequest(UpdateProductLowStockThresholdDocument, {
    productId,
    threshold,
    clear: threshold === null,
  })
  return toProductRow(data.updateProductLowStockThreshold.product)
}

export const inventoryKeys = {
  schema: (includeInactive: boolean) => ['inventory', 'schema', includeInactive] as const,
  dashboard: () => ['inventory', 'dashboard'] as const,
  products: (variables: Record<string, unknown>) =>
    ['inventory', 'products', variables] as const,
  product: (id: string) => ['inventory', 'product', id] as const,
  movements: (id: string) => ['inventory', 'movements', id] as const,
  breakdown: (id: string) => ['inventory', 'breakdown', id] as const,
  alerts: () => ['inventory', 'alerts'] as const,
  imports: () => ['inventory', 'imports'] as const,
  import: (id: string) => ['inventory', 'import', id] as const,
  importTemplate: () => ['inventory', 'import-template'] as const,
  exports: () => ['inventory', 'exports'] as const,
  export: (id: string) => ['inventory', 'export', id] as const,
}
