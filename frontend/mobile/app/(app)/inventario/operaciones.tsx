import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PrimaryButton, colors } from '../../../components/auth-ui'
import { SectionCard } from '../../../components/inventory-ui'
import { formatDate, formatQuantity } from '../../../lib/format'
import {
  fetchInventoryExports,
  fetchInventoryImports,
  inventoryKeys,
} from '../../../lib/inventory-api'

const ACTIVE = new Set(['analysing', 'queued', 'processing'])
const statusLabels: Record<string, string> = {
  analysing: 'Analizando',
  awaiting_mapping: 'Esperando mapeo en web',
  queued: 'En cola',
  processing: 'Procesando',
  succeeded: 'Completada',
  completed_with_errors: 'Completada con errores',
  failed: 'Fallida',
}

/** Mobile deliberately observes bulk jobs; file mapping stays on the web. */
export default function InventoryJobsScreen() {
  const [pollDelay, setPollDelay] = useState(1_000)
  const imports = useQuery({
    queryKey: [...inventoryKeys.jobs(), 'imports'],
    queryFn: fetchInventoryImports,
    refetchInterval: (query) =>
      query.state.data?.some((job) => ACTIVE.has(job.status)) ? pollDelay : false,
  })
  const exportsQuery = useQuery({
    queryKey: [...inventoryKeys.jobs(), 'exports'],
    queryFn: fetchInventoryExports,
    refetchInterval: (query) =>
      query.state.data?.some((job) => ACTIVE.has(job.status)) ? pollDelay : false,
  })

  useEffect(() => {
    const hasActive =
      imports.data?.some((job) => ACTIVE.has(job.status)) ||
      exportsQuery.data?.some((job) => ACTIVE.has(job.status))
    setPollDelay((current) =>
      hasActive ? Math.min(Math.round(current * 1.6), 8_000) : 1_000,
    )
  }, [exportsQuery.data, imports.data])

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Inventario</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Importaciones y exportaciones
          </Text>
          <Text style={styles.muted}>
            Consulta progreso y resultados. La carga y el mapeo masivo se realizan en la
            versión web.
          </Text>
        </View>
        <PrimaryButton
          label="Volver al inventario"
          variant="secondary"
          onPress={() => router.back()}
        />

        <SectionCard title="Importaciones">
          {imports.isPending ? <Text style={styles.muted}>Cargando…</Text> : null}
          {imports.isError ? (
            <PrimaryButton
              label="Reintentar"
              variant="secondary"
              onPress={() => void imports.refetch()}
            />
          ) : null}
          {imports.data?.map((job) => (
            <View key={job.id} style={styles.job}>
              <Text style={styles.jobTitle}>{job.sourceFileName}</Text>
              <Text style={styles.muted}>
                {statusLabels[job.status] ?? job.status} · {job.progress}%
              </Text>
              <Text style={styles.muted}>
                {formatQuantity(job.createdCount)} creadas ·{' '}
                {formatQuantity(job.errorCount)} con error
              </Text>
              <Text style={styles.muted}>{formatDate(job.createdAt)}</Text>
              {job.reportUrl ? (
                <PrimaryButton
                  label="Abrir reporte"
                  variant="secondary"
                  onPress={() => void Linking.openURL(job.reportUrl ?? '')}
                />
              ) : null}
            </View>
          ))}
          {imports.data && !imports.data.length ? (
            <Text style={styles.muted}>No hay importaciones recientes.</Text>
          ) : null}
        </SectionCard>

        <SectionCard title="Exportaciones">
          {exportsQuery.isPending ? <Text style={styles.muted}>Cargando…</Text> : null}
          {exportsQuery.isError ? (
            <PrimaryButton
              label="Reintentar"
              variant="secondary"
              onPress={() => void exportsQuery.refetch()}
            />
          ) : null}
          {exportsQuery.data?.map((job) => (
            <View key={job.id} style={styles.job}>
              <Text style={styles.jobTitle}>{job.fileFormat.toUpperCase()}</Text>
              <Text style={styles.muted}>
                {statusLabels[job.status] ?? job.status} · {job.progress}%
              </Text>
              <Text style={styles.muted}>
                {formatQuantity(job.rowCount)} productos · {formatDate(job.createdAt)}
              </Text>
              {job.downloadUrl ? (
                <PrimaryButton
                  label="Descargar"
                  variant="secondary"
                  onPress={() => void Linking.openURL(job.downloadUrl ?? '')}
                />
              ) : null}
            </View>
          ))}
          {exportsQuery.data && !exportsQuery.data.length ? (
            <Text style={styles.muted}>No hay exportaciones recientes.</Text>
          ) : null}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.paper, flex: 1 },
  content: { gap: 16, padding: 20, paddingBottom: 44 },
  heading: { gap: 8 },
  eyebrow: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  muted: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  job: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: 6,
    paddingTop: 12,
  },
  jobTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
})
