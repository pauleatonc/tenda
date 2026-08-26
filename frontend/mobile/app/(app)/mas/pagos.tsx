import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MobileEmptyState, MobileStatusChip } from '../../../components/app-ui'
import { PrimaryButton, StatusMessage, colors } from '../../../components/auth-ui'
import { SectionCard } from '../../../components/inventory-ui'
import { DetailRow, salesStyles } from '../../../components/sales-ui'
import { MobileApiError, getMobileViewer } from '../../../lib/auth-api'
import { formatDate } from '../../../lib/format'
import {
  disconnectMercadoPagoConnection,
  fetchSellerPaymentConnection,
  salesKeys,
  startMercadoPagoConnection,
} from '../../../lib/sales-api'

const CONNECTION_LABELS: Record<string, string> = {
  pending: 'Conexión pendiente',
  connected: 'Conectada',
  disconnected: 'Desconectada',
  error: 'Requiere atención',
}

export default function PaymentsScreen() {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const oauthOpened = useRef(false)

  const viewer = useQuery({
    queryKey: ['mobile-viewer'],
    queryFn: getMobileViewer,
    retry: false,
  })
  const canManage =
    viewer.data?.membership.role === 'owner' &&
    viewer.data.membership.permissions.manageSensitiveConfiguration
  const payment = useQuery({
    queryKey: salesKeys.paymentConnection(),
    queryFn: fetchSellerPaymentConnection,
    enabled: canManage,
  })

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && oauthOpened.current) {
        oauthOpened.current = false
        setMessage('Comprobando el estado de la conexión…')
        void payment.refetch()
      }
    })
    return () => subscription.remove()
  }, [payment])

  const connect = useMutation({
    mutationFn: startMercadoPagoConnection,
    onSuccess: async (started) => {
      setError('')
      setMessage(
        'Abrimos Mercado Pago en el navegador. Al volver, actualizaremos el estado.',
      )
      oauthOpened.current = true
      try {
        await Linking.openURL(started.authorizationUrl)
      } catch {
        oauthOpened.current = false
        setError('No pudimos abrir el navegador. Inténtalo otra vez.')
      }
    },
    onError: (cause: unknown) => {
      setError(
        cause instanceof MobileApiError
          ? cause.message
          : 'No pudimos iniciar la conexión.',
      )
    },
  })

  const disconnect = useMutation({
    mutationFn: disconnectMercadoPagoConnection,
    onSuccess: () => {
      setError('')
      setMessage('Mercado Pago quedó desconectado.')
      void queryClient.invalidateQueries({ queryKey: salesKeys.paymentConnection() })
    },
    onError: (cause: unknown) => {
      setError(
        cause instanceof MobileApiError
          ? cause.message
          : 'No pudimos desconectar Mercado Pago.',
      )
    },
  })

  function confirmDisconnect() {
    if (disconnect.isPending) return
    Alert.alert(
      'Desconectar Mercado Pago',
      'Las ventas nuevas no podrán ofrecer Mercado Pago hasta volver a conectar la cuenta.',
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: () => disconnect.mutate(),
        },
      ],
    )
  }

  if (viewer.isPending) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <Text style={styles.loading}>Verificando acceso…</Text>
      </SafeAreaView>
    )
  }

  if (!canManage) {
    return (
      <SafeAreaView style={salesStyles.safeArea}>
        <View style={styles.state}>
          <MobileEmptyState
            title="Solo el Owner puede configurar pagos"
            description="La conexión usa permisos sensibles del negocio."
            action={<PrimaryButton label="Volver" onPress={() => router.back()} />}
          />
        </View>
      </SafeAreaView>
    )
  }

  const connection = payment.data?.sellerPaymentConnection
  const commission = payment.data?.paymentCommissionConfiguration

  return (
    <SafeAreaView style={salesStyles.safeArea}>
      <ScrollView contentContainerStyle={salesStyles.content}>
        <View style={styles.heading}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>‹ Más</Text>
          </Pressable>
          <Text style={styles.eyebrow}>Configuración segura</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Pagos
          </Text>
          <Text style={salesStyles.muted}>
            Conecta la cuenta del negocio con OAuth. Tenda nunca solicita usuario,
            contraseña ni claves de Mercado Pago.
          </Text>
        </View>

        {message ? <StatusMessage kind="success" message={message} /> : null}
        {error ? <StatusMessage message={error} /> : null}

        {payment.isPending ? (
          <Text accessibilityLiveRegion="polite" style={styles.loadingInline}>
            Cargando conexión…
          </Text>
        ) : payment.isError ? (
          <MobileEmptyState
            title="No pudimos consultar Mercado Pago"
            description={
              payment.error instanceof MobileApiError
                ? payment.error.message
                : 'Revisa tu conexión e inténtalo otra vez.'
            }
            action={
              <PrimaryButton label="Reintentar" onPress={() => void payment.refetch()} />
            }
          />
        ) : (
          <>
            <SectionCard
              title="Mercado Pago"
              action={
                <MobileStatusChip
                  label={
                    connection
                      ? CONNECTION_LABELS[connection.status] ?? connection.status
                      : 'Sin conectar'
                  }
                  tone={connection?.status === 'connected' ? 'success' : 'warning'}
                />
              }
            >
              {connection ? (
                <>
                  <DetailRow
                    label="Cuenta"
                    value={connection.providerAccountId || 'Pendiente de autorización'}
                  />
                  <DetailRow
                    label="Scopes autorizados"
                    value={
                      connection.scopes.length
                        ? connection.scopes.join(', ')
                        : 'Pendientes'
                    }
                  />
                  <DetailRow
                    label="Última conexión / sincronización conocida"
                    value={formatDate(connection.connectedAt)}
                  />
                  <DetailRow
                    label="Vencimiento de autorización"
                    value={formatDate(connection.tokenExpiresAt)}
                  />
                  {connection.disconnectedAt ? (
                    <DetailRow
                      label="Desconectada"
                      value={formatDate(connection.disconnectedAt)}
                    />
                  ) : null}
                </>
              ) : (
                <Text style={salesStyles.muted}>
                  Aún no hay una cuenta vinculada. Mercado Pago permanecerá desactivado
                  al crear ventas.
                </Text>
              )}

              {connection?.status === 'connected' ? (
                <PrimaryButton
                  label="Desconectar"
                  variant="secondary"
                  loading={disconnect.isPending}
                  onPress={confirmDisconnect}
                />
              ) : (
                <PrimaryButton
                  label={
                    connection?.status === 'pending'
                      ? 'Continuar conexión'
                      : 'Conectar Mercado Pago'
                  }
                  loading={connect.isPending}
                  onPress={() => connect.mutate()}
                />
              )}
              <PrimaryButton
                label="Actualizar estado"
                variant="secondary"
                onPress={() => void payment.refetch()}
              />
            </SectionCard>

            {commission ? (
              <SectionCard title="Comisión configurada">
                <DetailRow label="Modo" value={commission.mode} />
                <DetailRow label="Tasa" value={commission.rate} />
                <DetailRow
                  label="Mínimo operacional"
                  value={`$${commission.minimum} CLP`}
                />
                <Text style={salesStyles.muted}>
                  La comisión efectiva se informa al comprador antes de confirmar. El
                  retorno del navegador no marca un pago como aprobado: Tenda espera la
                  verificación del proveedor.
                </Text>
              </SectionCard>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  loading: { color: colors.inkSoft, padding: 24 },
  loadingInline: { color: colors.inkSoft, paddingVertical: 30, textAlign: 'center' },
  state: { padding: 20 },
  heading: { gap: 7 },
  back: { color: colors.green, fontSize: 14, fontWeight: '800', paddingVertical: 7 },
  eyebrow: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: colors.ink, fontSize: 29, fontWeight: '800', letterSpacing: -1 },
})
