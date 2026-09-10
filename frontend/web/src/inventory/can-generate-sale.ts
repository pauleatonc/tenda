export function canGenerateSale(product: {
  catalogStatus: string
  salePrice: string | null
  stock: { available: number }
}): boolean {
  return (
    product.catalogStatus === 'active' &&
    product.stock.available > 0 &&
    Boolean(product.salePrice)
  )
}
