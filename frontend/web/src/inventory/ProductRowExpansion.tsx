import { useQuery } from '@tanstack/react-query'

import { fetchProductBreakdown, inventoryKeys } from './api'
import { formatPrice, formatQuantity } from './format'

/**
 * Lazily loads the breakdown so opening a row never downloads the whole
 * history: the first line is always aggregated availability, and reservations
 * or sales not yet received follow underneath.
 */
export function ProductRowExpansion({
  productId,
  productName,
}: {
  productId: string
  productName: string
}) {
  const breakdown = useQuery({
    queryKey: inventoryKeys.breakdown(productId),
    queryFn: () => fetchProductBreakdown(productId),
  })

  if (breakdown.isPending) {
    return (
      <p className="expansion__status" aria-live="polite">
        Cargando disponibilidad de {productName}…
      </p>
    )
  }

  if (breakdown.isError) {
    return (
      <p className="expansion__status expansion__status--error" role="alert">
        No pudimos cargar el desglose.{' '}
        <button type="button" onClick={() => void breakdown.refetch()}>
          Reintentar
        </button>
      </p>
    )
  }

  const data = breakdown.data
  const activeLines = data.lines.filter((line) => line.kind !== 'available')

  return (
    <div className="expansion">
      <p className="expansion__available">
        <strong>{formatQuantity(data.available)}</strong> unidades disponibles sin
        compromiso.
      </p>
      {activeLines.length ? (
        <table className="expansion__table">
          <thead>
            <tr>
              <th scope="col">Operación</th>
              <th scope="col">Cantidad</th>
              <th scope="col">Precio efectivo</th>
              <th scope="col">Comprador</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.lines
              .filter((line) => line.kind !== 'available')
              .map((line, index) => (
                <tr key={`${line.kind}-${line.referenceId ?? index}`}>
                  <td>{line.label}</td>
                  <td>{formatQuantity(line.quantity)}</td>
                  <td>{formatPrice(line.effectivePrice)}</td>
                  <td>{line.buyerName || '—'}</td>
                  <td>{line.status || '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <p className="expansion__empty">
          No hay reservas ni ventas activas para este producto.
        </p>
      )}
      {data.pageInfo.hasNextPage ? (
        <p className="expansion__more">
          Se muestran las primeras operaciones activas. Abre el detalle para ver el resto.
        </p>
      ) : null}
    </div>
  )
}
