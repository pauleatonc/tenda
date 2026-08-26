import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MobileEmptyState } from '../../../../components/app-ui'
import { PrimaryButton, StatusMessage, colors } from '../../../../components/auth-ui'
import { SectionCard, SheetField } from '../../../../components/inventory-ui'
import { DetailRow, salesStyles } from '../../../../components/sales-ui'
import { ticketStatusLabels } from '../../../../components/shipping-ui'
import { MobileApiError } from '../../../../lib/auth-api'
import { formatDate } from '../../../../lib/format'
import { newIdempotencyKey } from '../../../../lib/graphql'
import {
  fetchTicket,
  resolveTicket,
  sendTicketMessage,
  shippingKeys,
  type SellerTicket,
} from '../../../../lib/shipping-api'

const authorLabels: Record<string, string> = {
  buyer: 'Comprador',
  seller: 'Tú',
  system: 'Tenda',
}

export default function ShipmentTicketScreen() {
  const params = useLocalSearchParams<{ ticketId?: string }>()
  const ticketId = typeof params.ticketId === 'string' ? params.ticketId : ''
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const [replyKey, setReplyKey] = useState(newIdempotencyKey)
  const [resolveKey, setResolveKey] = useState(newIdempotencyKey)
  const replyLock = useRef(false)
  const resolveLock = useRef(false)

  const ticket = useQuery({
    queryKey: shippingKeys.ticket(ticketId),
    queryFn: () => fetchTicket(ticketId),
    enabled: Boolean(ticketId),
  })

  const reply = useMutation({
    mutationFn: () =>
      sendTicketMessage({
        ticketId,
        body: body.trim(),
        idempotencyKey: replyKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.ticket(ticketId), result.ticket)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setBody('')
      setReplyKey(newIdempotencyKey())
      setActionError('')
      setSuccess('Mensaje enviado.')
      replyLock.current = false
    },
    onError: (error: Error) => {
      setActionError(
        error instanceof MobileApiError ? error.message : 'No se pudo enviar.',
      )
      replyLock.current = false
    },
  })

  const resolve = useMutation({
    mutationFn: () =>
      resolveTicket({
        ticketId,
        comment: body.trim() || null,
        idempotencyKey: resolveKey,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shippingKeys.ticket(ticketId), result.ticket)
      void queryClient.invalidateQueries({ queryKey: shippingKeys.root })
      setBody('')
      setResolveKey(newIdempotencyKey())
      setActionError('')
      setSuccess('Consulta marcada como resuelta.')
      resolveLock.current = false
    },
    onError: (error: Error) => {
      setActionError(
        error instanceof MobileApiError ? error.message : 'No se pudo resolver.',
      )
      resolveLock.current = false
    },
  })

  if (ticket.isError) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <View style={styles.state}>
          <MobileEmptyState
            title="No pudimos cargar la consulta"
            description={
              ticket.error instanceof MobileApiError
                ? ticket.error.message
                : 'Revisa tu conexión e inténtalo otra vez.'
            }
            action={
              <PrimaryButton label="Reintentar" onPress={() => void ticket.refetch()} />
            }
          />
        </View>
      </SafeAreaView>
    )
  }

  if (!ticket.data && !ticket.isPending) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <View style={styles.state}>
          <MobileEmptyState
            title="Consulta no encontrada"
            description="No existe o pertenece a otra organización."
            action={<PrimaryButton label="Volver" onPress={() => router.back()} />}
          />
        </View>
      </SafeAreaView>
    )
  }

  if (ticket.isPending || !ticket.data) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <View style={styles.state}>
          <Text style={salesStyles.muted}>Cargando consulta…</Text>
        </View>
      </SafeAreaView>
    )
  }

  const detail: SellerTicket = ticket.data
  const open = ['open', 'awaiting_seller', 'awaiting_buyer'].includes(detail.status)

  return (
    <SafeAreaView style={salesStyles.safeArea}>
      <ScrollView contentContainerStyle={salesStyles.content}>
        <View style={styles.heading}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>‹ Despacho</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>
            Consulta {detail.number}
          </Text>
          <Text style={salesStyles.muted}>
            {ticketStatusLabels[detail.status] ?? detail.status} · Envío{' '}
            {detail.shipment.number} · Venta {detail.shipment.orderNumber}
          </Text>
        </View>

        {success ? <StatusMessage kind="success" message={success} /> : null}
        {actionError ? <StatusMessage kind="error" message={actionError} /> : null}

        <SectionCard title="Contexto">
          <DetailRow label="Contacto" value={detail.contactName || '—'} />
          <DetailRow label="Correo" value={detail.contactEmail || '—'} />
          <DetailRow label="Teléfono" value={detail.contactPhone || '—'} />
        </SectionCard>

        <SectionCard title="Conversación">
          {detail.messages.map((item) => (
            <View key={item.id} style={styles.message}>
              <Text style={styles.author}>
                {authorLabels[item.authorKind] ?? item.authorKind} ·{' '}
                {formatDate(item.createdAt)}
              </Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          ))}
        </SectionCard>

        {open ? (
          <SectionCard title="Responder">
            <SheetField label="Mensaje" value={body} onChangeText={setBody} multiline />
            <PrimaryButton
              label="Enviar mensaje"
              loading={reply.isPending}
              onPress={() => {
                if (replyLock.current || reply.isPending) return
                replyLock.current = true
                reply.mutate()
              }}
            />
            <PrimaryButton
              label="Marcar como resuelta"
              variant="secondary"
              loading={resolve.isPending}
              onPress={() => {
                if (resolveLock.current || resolve.isPending) return
                resolveLock.current = true
                resolve.mutate()
              }}
            />
          </SectionCard>
        ) : (
          <Text style={salesStyles.muted}>Esta consulta ya quedó resuelta.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  heading: { gap: 6, marginBottom: 12 },
  back: { color: colors.green, fontSize: 16, fontWeight: '700' },
  title: { color: colors.ink, fontSize: 24, fontWeight: '800' },
  state: { flex: 1, justifyContent: 'center', padding: 24 },
  message: { gap: 4, marginBottom: 12 },
  author: { color: colors.inkSoft, fontSize: 12, fontWeight: '700' },
  body: { color: colors.ink, fontSize: 16, lineHeight: 22 },
})
