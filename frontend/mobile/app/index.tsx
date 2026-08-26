import { useQuery } from '@tanstack/react-query'
import { Link } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getStoredToken } from '../lib/auth-api'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'

async function getHealth(): Promise<string> {
  const response = await fetch(`${API_URL}/health/live/`)
  if (!response.ok) {
    throw new Error('No fue posible conectar con Tenda')
  }
  const payload = (await response.json()) as { status: string }
  return payload.status
}

export default function HomeScreen() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
  })
  const storedToken = useQuery({
    queryKey: ['stored-token'],
    queryFn: getStoredToken,
  })

  const serviceLabel = health.isPending
    ? 'Comprobando servicio…'
    : health.isError
      ? 'Servicio no disponible'
      : 'Servicio disponible'

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.brand}>
          <Text style={styles.eyebrow}>TENDA</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Tu negocio, más simple.
          </Text>
          <Text style={styles.description}>
            Inventario, ventas y despachos en un solo lugar.
          </Text>
        </View>

        <View
          accessibilityLiveRegion="polite"
          style={[styles.status, health.isError && styles.statusError]}
        >
          <View style={[styles.dot, health.isError && styles.dotError]} />
          <Text style={styles.statusText}>{serviceLabel}</Text>
        </View>

        <View style={styles.actions}>
          <Link asChild href={storedToken.data ? '/(app)' : '/(auth)/login'}>
            <Pressable accessibilityRole="button" style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>
                {storedToken.data ? 'Continuar en Tenda' : 'Iniciar sesión'}
              </Text>
            </Pressable>
          </Link>
          {!storedToken.data ? (
            <Link asChild href="/(auth)/registro">
              <Pressable accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Crear cuenta</Text>
              </Pressable>
            </Link>
          ) : null}
        </View>

        <View style={styles.upcoming}>
          <Text style={styles.upcomingTitle}>Asistente con foto</Text>
          <Text style={styles.upcomingBadge}>Próximamente</Text>
          <Text style={styles.upcomingBody}>
            El inventario manual seguirá disponible aunque el asistente no lo esté.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f5ef',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  brand: {
    paddingTop: 56,
  },
  eyebrow: {
    color: '#175c4d',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 18,
  },
  title: {
    color: '#17201d',
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -1.5,
    lineHeight: 48,
    maxWidth: 320,
  },
  description: {
    color: '#5e6763',
    fontSize: 18,
    lineHeight: 27,
    marginTop: 16,
    maxWidth: 320,
  },
  status: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#e2efe9',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  statusError: {
    backgroundColor: '#f9e4df',
  },
  dot: {
    backgroundColor: '#24876f',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  dotError: {
    backgroundColor: '#b4422e',
  },
  statusText: {
    color: '#24302c',
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#175c4d',
    borderRadius: 13,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dedbd1',
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: '#175c4d',
    fontSize: 15,
    fontWeight: '800',
  },
  upcoming: {
    backgroundColor: '#ffffff',
    borderColor: '#dedbd1',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  upcomingTitle: {
    color: '#17201d',
    fontSize: 18,
    fontWeight: '700',
  },
  upcomingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#efe9d4',
    borderRadius: 999,
    color: '#6f5d1d',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  upcomingBody: {
    color: '#69716e',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
})
