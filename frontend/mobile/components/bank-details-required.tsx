import { router } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { BANK_DETAILS_REQUIRED_MESSAGE } from '@tenda/api-client'

import { PrimaryButton } from './auth-ui'

export function BankDetailsRequired({
  onPress,
}: {
  onPress?: () => void
}) {
  return (
    <View accessibilityRole="summary" style={styles.card}>
      <Text style={styles.title}>Faltan datos bancarios</Text>
      <Text style={styles.copy}>{BANK_DETAILS_REQUIRED_MESSAGE}</Text>
      <PrimaryButton
        label="Agregar datos bancarios"
        onPress={onPress ?? (() => router.push('/mas/perfil'))}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff8e3',
    borderColor: '#dfc56d',
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  title: { color: '#5d4a12', fontSize: 16, fontWeight: '800' },
  copy: { color: '#5d4a12', fontSize: 14, lineHeight: 20 },
})
