import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { AppScreen } from '../../../components/app-ui'
import { colors } from '../../../components/auth-ui'
import { getMobileViewer, mobileLogout } from '../../../lib/auth-api'
import { BankAccountsSection } from '../mas/cuentas'
import { PaymentsSection } from '../mas/pagos'
import { ProfileSection } from '../mas/perfil'
import { PlanSection } from '../mas/plan'

const SECTIONS = [
  { id: 'perfil', label: 'Perfil empresa' },
  { id: 'plan', label: 'Plan' },
  { id: 'pagos', label: 'Integración de pago' },
  { id: 'cuentas', label: 'Cuentas bancarias' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

function sectionFromParam(value: string | string[] | undefined): SectionId | null {
  const raw = Array.isArray(value) ? value[0] : value
  return SECTIONS.some((section) => section.id === raw) ? (raw as SectionId) : null
}

export default function AccountScreen() {
  const queryClient = useQueryClient()
  const params = useLocalSearchParams<{ seccion?: string | string[] }>()
  const [section, setSection] = useState<SectionId | null>(
    sectionFromParam(params.seccion),
  )
  const [loggingOut, setLoggingOut] = useState(false)
  const viewer = useQuery({
    queryKey: ['mobile-viewer'],
    queryFn: getMobileViewer,
    retry: false,
  })
  const canManage =
    viewer.data?.membership.role === 'owner' &&
    viewer.data.membership.permissions.manageSensitiveConfiguration
  const sections = canManage ? SECTIONS : SECTIONS.filter((item) => item.id === 'perfil')

  useEffect(() => {
    const next = sectionFromParam(params.seccion)
    if (next && !canManage && next !== 'perfil') {
      setSection(null)
      return
    }
    setSection(next)
  }, [canManage, params.seccion])

  function toggleSection(id: SectionId) {
    const next = section === id ? null : id
    setSection(next)
    router.setParams({ seccion: next ?? '' })
  }

  return (
    <AppScreen title="Cuenta" eyebrow="Tu negocio">
      <View style={styles.list}>
        {sections.map((item) => {
          const expanded = section === item.id
          return (
            <View key={item.id} style={styles.item}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => toggleSection(item.id)}
                style={[styles.row, expanded && styles.rowExpanded]}
              >
                <Text style={[styles.rowLabel, expanded && styles.rowLabelExpanded]}>
                  {item.label}
                </Text>
                <Text style={[styles.chevron, expanded && styles.rowLabelExpanded]}>
                  {expanded ? '▾' : '›'}
                </Text>
              </Pressable>
              {expanded ? (
                <View style={styles.panel}>
                  {item.id === 'perfil' ? <ProfileSection /> : null}
                  {item.id === 'plan' ? <PlanSection /> : null}
                  {item.id === 'pagos' ? <PaymentsSection /> : null}
                  {item.id === 'cuentas' ? <BankAccountsSection /> : null}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={loggingOut}
        style={styles.logout}
        onPress={async () => {
          setLoggingOut(true)
          try {
            await mobileLogout()
            queryClient.clear()
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
  list: { gap: 8 },
  item: {
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  rowExpanded: { backgroundColor: colors.green },
  rowLabel: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  rowLabelExpanded: { color: '#fff' },
  chevron: { color: colors.inkSoft, fontSize: 18, fontWeight: '700' },
  panel: { padding: 12 },
  logout: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
  },
  logoutText: { color: colors.green, fontWeight: '800' },
})
