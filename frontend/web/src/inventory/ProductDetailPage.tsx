import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { EmptyState, Modal, StatusChip } from '../components/ui'
import { TendaApiError } from '../lib/http'
import {
  archiveProduct,
  fetchInventorySchema,
  fetchProductDetail,
  fetchProductMovements,
  inventoryKeys,
  restoreProduct,
} from './api'
import { StockAdjustDialog } from './StockAdjustDialog'
import {
  catalogStatusLabels,
  formatAttribute,
  formatDate,
  formatPrice,
  formatQuantity,
  formatSignedQuantity,
  movementLabels,
} from './format'
import { ProductMediaGallery } from './ProductMediaGallery'
import { ProductThresholdSetting } from './StockThresholdSettings'

export function ProductDetailPage() {
  const { productId = '' } = useParams<{ productId: string }>()
  const queryClient = useQueryClient()
  const [adjusting, setAdjusting] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [actionError, setActionError] = useState<TendaApiError | null>(null)

  const detail = useQuery({
    queryKey: inventoryKeys.product(productId),
    queryFn: () => fetchProductDetail(productId),
    enabled: Boolean(productId),
  })

  const schema = useQuery({
    queryKey: inventoryKeys.schema(true),
    queryFn: () => fetchInventorySchema(true),
  })

  const movements = useQuery({
    queryKey: inventoryKeys.movements(productId),
    queryFn: () => fetchProductMovements({ productId }),
    enabled: Boolean(productId),
  })

  function refreshInventory() {
    void queryClient.invalidateQueries({ queryKey: ['inventory'] })
  }

  const archive = useMutation({
    mutationFn: () => archiveProduct(productId),
    onSuccess: () => {
      setConfirmArchive(false)
      setActionError(null)
      refreshInventory()
    },
    onError: (error: unknown) => {
      setActionError(error instanceof TendaApiError ? error : null)
    },
  })

  const restore = useMutation({
    mutationFn: () => restoreProduct(productId),
    onSuccess: () => {
      setActionError(null)
      refreshInventory()
    },
    onError: (error: unknown) => {
      setActionError(error instanceof TendaApiError ? error : null)
    },
  })

  if (detail.isPending) {
    return <p aria-live="polite">Cargando producto…</p>
  }

  if (detail.isError) {
    return (
      <EmptyState
        title="No pudimos cargar el producto"
        description={
          detail.error instanceof TendaApiError
            ? detail.error.message
            : 'Revisa tu conexión e inténtalo nuevamente.'
        }
        action={
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void detail.refetch()}
          >
            Reintentar
          </button>
        }
      />
    )
  }

  if (!detail.data) {
    return (
      <EmptyState
        title="Producto no encontrado"
        description="El producto no existe o pertenece a otra Tienda."
        action={
          <Link className="button button--secondary" to="/app/inventario">
            Volver al inventario
          </Link>
        }
      />
    )
  }

  const { product, breakdown, orders, shipments } = detail.data
  const activeLines = breakdown.lines.filter((line) => line.kind !== 'available')
  const fields = schema.data?.fields ?? []

  return (
    <>
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">
            <Link to="/app/inventario">Inventario</Link>
          </p>
          <h1>{product.name}</h1>
          <div className="stock-chips">
            {product.stock.available > 0 ? (
              <StatusChip
                status="available"
                label={`Disponible ${product.stock.available}`}
              />
            ) : (
              <StatusChip status="error" label="Sin unidades disponibles" />
            )}
            {product.stock.reserved > 0 ? (
              <StatusChip
                status="reserved"
                label={`Reservado ${product.stock.reserved}`}
              />
            ) : null}
            {product.stock.activeFulfilment > 0 ? (
              <StatusChip
                status="pending"
                label={`En proceso ${product.stock.activeFulfilment}`}
              />
            ) : null}
            <StatusChip
              status={product.catalogStatus === 'active' ? 'active' : 'coming_soon'}
              label={catalogStatusLabels[product.catalogStatus] ?? product.catalogStatus}
            />
          </div>
        </div>
        <div className="page-heading__actions">
          <Link
            className="button button--secondary"
            to={`/app/inventario/${product.id}/editar`}
          >
            Editar
          </Link>
          <button
            className="button button--primary"
            type="button"
            disabled={product.catalogStatus === 'archived'}
            onClick={() => setAdjusting(true)}
          >
            Ajustar stock
          </button>
          {product.catalogStatus === 'archived' ? (
            <button
              className="button button--secondary"
              type="button"
              disabled={restore.isPending}
              onClick={() => restore.mutate()}
            >
              {restore.isPending ? 'Reactivando…' : 'Reactivar'}
            </button>
          ) : (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setConfirmArchive(true)}
            >
              Archivar
            </button>
          )}
        </div>
      </header>

      {actionError ? (
        <div className="form-message form-message--error" role="alert">
          <strong>No pudimos completar la acción</strong>
          <span>{actionError.message}</span>
          {actionError.correlationId ? (
            <small>Referencia: {actionError.correlationId}</small>
          ) : null}
        </div>
      ) : null}

      <section className="detail-grid" aria-label="Resumen">
        <article className="detail-card">
          <h2>Resumen</h2>
          <dl>
            <div>
              <dt>Total en inventario</dt>
              <dd>{formatQuantity(product.stock.onHand)}</dd>
            </div>
            <div>
              <dt>Disponible</dt>
              <dd>{formatQuantity(product.stock.available)}</dd>
            </div>
            <div>
              <dt>Reservado</dt>
              <dd>{formatQuantity(product.stock.reserved)}</dd>
            </div>
            <div>
              <dt>Precio de compra ref.</dt>
              <dd>{formatPrice(product.purchasePrice)}</dd>
            </div>
            <div>
              <dt>Precio de venta ref.</dt>
              <dd>{formatPrice(product.salePrice)}</dd>
            </div>
            <div>
              <dt>Creado</dt>
              <dd>{formatDate(product.createdAt)}</dd>
            </div>
          </dl>
          <ProductThresholdSetting
            productId={product.id}
            value={product.lowStockThreshold}
            effective={product.effectiveLowStockThreshold}
          />
        </article>

        <article className="detail-card">
          <h2>Datos adicionales</h2>
          {fields.length ? (
            <dl>
              {fields.map((field) => (
                <div key={field.id}>
                  <dt>
                    {field.label}
                    {field.isActive ? '' : ' (columna desactivada)'}
                  </dt>
                  <dd>{formatAttribute(product.extraAttributes[field.key])}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="detail-card__empty">
              Este inventario no tiene columnas propias definidas.
            </p>
          )}
        </article>
      </section>

      <ProductMediaGallery
        productId={product.id}
        media={product.media}
        archived={product.catalogStatus === 'archived'}
      />

      <section
        className="detail-section"
        aria-label="Disponibilidad y operaciones activas"
      >
        <h2>Disponibilidad y operaciones activas</h2>
        <p className="detail-section__lead">
          <strong>{formatQuantity(breakdown.available)}</strong> unidades disponibles sin
          compromiso.
        </p>
        {activeLines.length ? (
          <table className="data-table">
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
              {activeLines.map((line, index) => (
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
          <p className="detail-card__empty">
            No hay reservas ni ventas activas para este producto.
          </p>
        )}
      </section>

      <section className="detail-section" aria-label="Movimientos">
        <h2>Movimientos</h2>
        {movements.isPending ? <p aria-live="polite">Cargando movimientos…</p> : null}
        {movements.data?.nodes.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Tipo</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Saldo posterior</th>
                <th scope="col">Motivo</th>
                <th scope="col">Responsable</th>
              </tr>
            </thead>
            <tbody>
              {movements.data.nodes.map((movement) => (
                <tr key={movement.id}>
                  <td>{formatDate(movement.createdAt)}</td>
                  <td>
                    {movementLabels[movement.movementType] ?? movement.movementType}
                  </td>
                  <td>{formatSignedQuantity(movement.quantity)}</td>
                  <td>{formatQuantity(movement.balanceAfter)}</td>
                  <td>{movement.reason || '—'}</td>
                  <td>{movement.actorName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {movements.data && !movements.data.nodes.length ? (
          <p className="detail-card__empty">Este producto aún no registra movimientos.</p>
        ) : null}
        {movements.data?.pageInfo.hasNextPage ? (
          <p className="detail-card__empty">Se muestran los movimientos más recientes.</p>
        ) : null}
      </section>

      <section className="detail-section" aria-label="Ventas relacionadas">
        <h2>Ventas relacionadas</h2>
        <p className="detail-card__empty">
          Las ventas de este producto aparecerán aquí cuando se habilite el módulo de
          ventas.
        </p>
        {orders.totalCount > 0 ? (
          <p>{formatQuantity(orders.totalCount)} ventas registradas.</p>
        ) : null}
      </section>

      <section className="detail-section" aria-label="Despachos relacionados">
        <h2>Despachos relacionados</h2>
        <p className="detail-card__empty">
          Los despachos aparecerán aquí cuando se habilite el seguimiento de entregas.
        </p>
        {shipments.totalCount > 0 ? (
          <p>{formatQuantity(shipments.totalCount)} despachos registrados.</p>
        ) : null}
      </section>

      {adjusting ? (
        <StockAdjustDialog product={product} onClose={() => setAdjusting(false)} />
      ) : null}

      {confirmArchive ? (
        <Modal
          title="Archivar producto"
          description="El producto deja de aparecer en el catálogo activo. El historial de movimientos se conserva."
          onClose={() => setConfirmArchive(false)}
          footer={
            <>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setConfirmArchive(false)}
              >
                Cancelar
              </button>
              <button
                className="button button--primary"
                type="button"
                disabled={archive.isPending}
                onClick={() => archive.mutate()}
              >
                {archive.isPending ? 'Archivando…' : 'Archivar producto'}
              </button>
            </>
          }
        >
          <p>
            ¿Quieres archivar <strong>{product.name}</strong>? Podrás reactivarlo más
            adelante y no se elimina ningún movimiento.
          </p>
          {product.stock.reserved > 0 ? (
            <p className="field__error">
              Este producto tiene {formatQuantity(product.stock.reserved)} unidades
              reservadas; libéralas antes de archivar.
            </p>
          ) : null}
        </Modal>
      ) : null}
    </>
  )
}
