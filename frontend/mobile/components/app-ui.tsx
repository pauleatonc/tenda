import type { PropsWithChildren, ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors } from './auth-ui'

export function AppScreen({
  title,
  eyebrow,
  children,
  action,
}: PropsWithChildren<{
  title: string
  eyebrow?: string
  action?: ReactNode
}>) {
  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
          </View>
          {action}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}

export function MobileStatusChip({
  label,
  tone = 'success',
}: {
  label: string
  tone?: 'success' | 'warning' | 'neutral'
}) {
  return (
    <View
      style={[
        styles.chip,
        tone === 'warning' && styles.chipWarning,
        tone === 'neutral' && styles.chipNeutral,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          tone === 'warning' && styles.chipTextWarning,
          tone === 'neutral' && styles.chipTextNeutral,
        ]}
      >
        {label}
      </Text>
    </View>
  )
}

export function MobileEmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>◇</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {action}
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.paper, flex: 1 },
  content: { gap: 24, padding: 22, paddingBottom: 40 },
  heading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  headingCopy: { flex: 1, gap: 8 },
  eyebrow: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 39,
  },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: '#e2efe9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipWarning: { backgroundColor: '#f4e5b7' },
  chipNeutral: { backgroundColor: '#eceae3' },
  chipText: { color: colors.green, fontSize: 12, fontWeight: '800' },
  chipTextWarning: { color: '#765c17' },
  chipTextNeutral: { color: colors.inkSoft },
  empty: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  emptyIcon: { color: '#bf7456', fontSize: 32 },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptyDescription: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 340,
    textAlign: 'center',
  },
})
