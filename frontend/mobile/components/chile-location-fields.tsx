import { CHILE_REGIONS, chileCommunes } from '@tenda/api-client'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors } from './auth-ui'
import { Sheet } from './inventory-ui'

function LocationPicker({
  label,
  value,
  placeholder,
  disabled = false,
  onPress,
}: {
  label: string
  value: string
  placeholder: string
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={[styles.picker, disabled && styles.pickerDisabled]}
      >
        <Text
          numberOfLines={1}
          style={[styles.pickerValue, !value && styles.pickerPlaceholder]}
        >
          {value || placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
    </View>
  )
}

export function ChileLocationFields({
  region,
  commune,
  onChange,
}: {
  region: string
  commune: string
  onChange: (next: { region: string; commune: string }) => void
}) {
  const [picking, setPicking] = useState<'region' | 'commune' | null>(null)
  const communes = chileCommunes(region)

  return (
    <View style={styles.stack}>
      <LocationPicker
        label="Región"
        value={region}
        placeholder="Selecciona una región"
        onPress={() => setPicking('region')}
      />
      <LocationPicker
        label="Comuna"
        value={commune}
        placeholder={region ? 'Selecciona una comuna' : 'Primero elige la región'}
        disabled={!region}
        onPress={() => setPicking('commune')}
      />
      <Sheet
        visible={picking === 'region'}
        title="Región"
        onClose={() => setPicking(null)}
      >
        {CHILE_REGIONS.map((item) => (
          <Pressable
            key={item.region}
            accessibilityRole="button"
            accessibilityLabel={item.region}
            onPress={() => {
              onChange({
                region: item.region,
                commune: chileCommunes(item.region).includes(commune) ? commune : '',
              })
              setPicking(null)
            }}
            style={[styles.option, item.region === region && styles.optionSelected]}
          >
            <Text
              style={[
                styles.optionText,
                item.region === region && styles.optionTextSelected,
              ]}
            >
              {item.region}
            </Text>
          </Pressable>
        ))}
      </Sheet>
      <Sheet
        visible={picking === 'commune'}
        title="Comuna"
        onClose={() => setPicking(null)}
      >
        {communes.map((name) => (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityLabel={name}
            onPress={() => {
              onChange({ region, commune: name })
              setPicking(null)
            }}
            style={[styles.option, name === commune && styles.optionSelected]}
          >
            <Text
              style={[styles.optionText, name === commune && styles.optionTextSelected]}
            >
              {name}
            </Text>
          </Pressable>
        ))}
      </Sheet>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  field: { gap: 7 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  picker: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: '#c9c6bc',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  pickerDisabled: {
    backgroundColor: '#f3f1ea',
  },
  pickerValue: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
  },
  pickerPlaceholder: {
    color: colors.inkMuted,
  },
  chevron: {
    color: colors.green,
    fontSize: 16,
    lineHeight: 18,
  },
  option: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  optionSelected: {
    backgroundColor: colors.greenPale,
  },
  optionText: {
    color: colors.ink,
    fontSize: 16,
  },
  optionTextSelected: {
    color: colors.green,
    fontWeight: '700',
  },
})
