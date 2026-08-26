import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { PrimaryButton, StatusMessage, colors } from './auth-ui'
import { OptionRow, Sheet, SheetField } from './inventory-ui'
import { MobileApiError } from '../lib/auth-api'
import { formatQuantity, movementLabels } from '../lib/format'
import { newIdempotencyKey } from '../lib/graphql'
import { recordStockMovement, type ProductCard } from '../lib/inventory-api'

const MOVEMENT_TYPES = ['entry', 'exit', 'shrinkage', 'correction'] as const
type MovementType = (typeof MOVEMENT_TYPES)[number]

function projectedBalance(
  current: number,
  movementType: MovementType,
  quantity: number,
): number {
  if (!Number.isFinite(quantity)) return current
  if (movementType === 'entry') return current + Math.abs(quantity)
  if (movementType === 'correction') return current + quantity
  return current - Math.abs(quantity)
}

/** Mobile counterpart of V1-INV-05: same rules as web, one column, big targets. */
export function StockAdjustSheet({
  product,
  visible,
  onClose,
  onDone,
}: {
  product: ProductCard
  visible: boolean
  onClose: () => void
  onDone?: (product: ProductCard) => void
}) {
  const queryClient = useQueryClient()
  const [movementType, setMovementType] = useState<MovementType>('entry')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<MobileApiError | null>(null)
  /** One key per open sheet: a retried confirm never doubles the movement. */
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)

  const parsedQuantity = Number(quantity.replace(',', '.'))
  const before = product.stock.onHand
  const after = projectedBalance(before, movementType, parsedQuantity)

  const reasonRequired = movementType === 'shrinkage' || movementType === 'correction'
  const invalidQuantity =
    quantity.trim() === '' ||
    !Number.isInteger(parsedQuantity) ||
    (movementType !== 'correction' && parsedQuantity <= 0) ||
    (movementType === 'correction' && parsedQuantity === 0)
  const wouldGoNegative = !invalidQuantity && after < 0
  const missingReason = reasonRequired && !reason.trim()
  const blocked = invalidQuantity || wouldGoNegative || missingReason

  const submit = useMutation({
    mutationFn: recordStockMovement,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      onDone?.(result.product)
      close()
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof MobileApiError ? mutationError : null)
      // A rejected attempt gets a fresh key so a corrected retry is accepted.
      setIdempotencyKey(newIdempotencyKey())
    },
  })

  function close() {
    setQuantity('')
    setReason('')
    setNote('')
    setError(null)
    setMovementType('entry')
    onClose()
  }

  return (
    <Sheet
      visible={visible}
      title="Ajustar stock"
      description={`${product.name} · el movimiento queda en el historial y no se edita.`}
      onClose={close}
      footer={
        <>
          <View style={styles.footerItem}>
            <PrimaryButton label="Cancelar" variant="secondary" onPress={close} />
          </View>
          <View style={styles.footerItem}>
            <PrimaryButton
              label="Confirmar ajuste"
              loading={submit.isPending}
              disabled={blocked}
              onPress={() => {
                if (blocked) return
                setError(null)
                submit.mutate({
                  productId: product.id,
                  movementType,
                  quantity:
                    movementType === 'correction'
                      ? parsedQuantity
                      : Math.abs(parsedQuantity),
                  reason: reason.trim() || null,
                  note: note.trim() || null,
                  idempotencyKey,
                })
              }}
            />
          </View>
        </>
      }
    >
      {error ? <StatusMessage message={error.message} /> : null}

      <OptionRow
        label="Tipo de movimiento"
        value={movementType}
        onChange={setMovementType}
        options={MOVEMENT_TYPES.map((type) => ({
          value: type,
          label: movementLabels[type],
        }))}
      />

      <SheetField
        label="Cantidad"
        help={
          movementType === 'correction'
            ? 'Usa signo negativo para descontar unidades.'
            : undefined
        }
        keyboardType={
          movementType === 'correction' ? 'numbers-and-punctuation' : 'number-pad'
        }
        value={quantity}
        onChangeText={setQuantity}
        placeholder="0"
      />

      <SheetField
        label="Motivo"
        help={reasonRequired ? undefined : 'Opcional'}
        value={reason}
        maxLength={120}
        onChangeText={setReason}
        error={
          missingReason ? 'Las mermas y correcciones necesitan un motivo.' : undefined
        }
      />

      <SheetField
        label="Nota"
        help="Opcional"
        value={note}
        maxLength={280}
        multiline
        numberOfLines={3}
        onChangeText={setNote}
      />

      <View accessibilityLiveRegion="polite" style={styles.balance}>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Saldo actual</Text>
          <Text style={styles.balanceValue}>{formatQuantity(before)}</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Saldo después</Text>
          <Text style={styles.balanceValue}>
            {invalidQuantity ? '—' : formatQuantity(after)}
          </Text>
        </View>
      </View>

      {wouldGoNegative ? (
        <Text accessibilityRole="alert" style={styles.error}>
          No hay unidades suficientes: el saldo quedaría en {formatQuantity(after)}.
        </Text>
      ) : null}
      {product.stock.reserved > 0 ? (
        <Text style={styles.hint}>
          {formatQuantity(product.stock.reserved)} unidades están reservadas y no pueden
          descontarse con un ajuste.
        </Text>
      ) : null}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  footerItem: { flex: 1 },
  balance: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 16,
  },
  balanceItem: { gap: 4 },
  balanceLabel: { color: colors.inkSoft, fontSize: 13 },
  balanceValue: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  arrow: { color: colors.inkMuted, fontSize: 18 },
  error: { color: colors.error, fontSize: 13, lineHeight: 19 },
  hint: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
})
