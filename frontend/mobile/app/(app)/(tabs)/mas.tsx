import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, router } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { AppScreen, MobileStatusChip } from '../../../components/app-ui'
import { colors } from '../../../components/auth-ui'
import { getMobileViewer, mobileLogout } from '../../../lib/auth-api'

export default function MoreScreen() {
  const queryClient = useQueryClient()
  const [loggingOut, setLoggingOut] = useState(false)
  const viewer = useQuery({
    queryKey: ['mobile-viewer'],
    queryFn: getMobileViewer,
    retry: false,
  })
  const data = viewer.data

  return (
    <AppScreen title="Más" eyebrow="Cuenta y negocio">
      <View style={styles.list}>
        <Link asChild href="/mas/perfil">
          <Pressable accessibilityRole="button" style={styles.row}>
            <View>
              <Text style={styles.rowTitle}>Perfil y negocio</Text>
              <Text style={styles.rowDetail}>{data?.viewer.email ?? 'Cargando…'}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
        {data?.membership.permissions.viewFinancials ? (
          <Link asChild href="/(app)/balances">
            <Pressable accessibilityRole="button" style={styles.row}>
              <View>
                <Text style={styles.rowTitle}>Balances</Text>
                <Text style={styles.rowDetail}>Información comercial</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </Link>
        ) : null}
        {data?.membership.role === 'owner' &&
        data.membership.permissions.manageSensitiveConfiguration ? (
          <Link asChild href="/mas/pagos">
            <Pressable accessibilityRole="button" style={styles.row}>
              <View>
                <Text style={styles.rowTitle}>Pagos</Text>
                <Text style={styles.rowDetail}>Conexión Mercado Pago</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </Link>
        ) : null}
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>Asistente con foto</Text>
            <Text style={styles.rowDetail}>El inventario manual sigue disponible</Text>
          </View>
          <MobileStatusChip label="Próximamente" tone="warning" />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={loggingOut}
        style={styles.logout}
        onPress={async () => {
          setLoggingOut(true)
          try {
            await mobileLogout()
            queryClient.removeQueries({ queryKey: ['mobile-viewer'] })
            router.replace('/(auth)/login')
          } finally {
            setLoggingOut(false)
          }
        }}
      >
        <Text style={styles.logoutText}>
          {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </Text>
      </Pressable>
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 76,
    paddingHorizontal: 18,
  },
  rowTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  rowDetail: { color: colors.inkSoft, fontSize: 12, marginTop: 4 },
  chevron: { color: colors.inkMuted, fontSize: 28 },
  logout: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  logoutText: { color: colors.green, fontWeight: '800' },
})
