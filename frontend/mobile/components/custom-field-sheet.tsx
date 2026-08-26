import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { PrimaryButton, StatusMessage, colors } from './auth-ui'
import { OptionRow, Sheet, SheetField } from './inventory-ui'
import { MobileApiError } from '../lib/auth-api'
import { fieldTypeLabels } from '../lib/format'
import { createCustomField, type CustomField } from '../lib/inventory-api'

const FIELD_TYPES = ['short_text', 'decimal', 'date', 'boolean', 'single_select'] as const
type FieldType = (typeof FIELD_TYPES)[number]

/** Mirrors `slugify_key` in the backend so the preview matches what is stored. */
function previewKey(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={styles.toggle}
    >
      <View style={[styles.box, value && styles.boxChecked]}>
        {value ? <Text style={styles.check}>✓</Text> : null}
      </View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  )
}

/**
 * V1-INV-06 on the phone. It only creates columns: reordering and deactivating
 * stay on web, where the whole schema is visible at once.
 */
export function CustomFieldSheet({
  visible,
  onClose,
  activeCount,
  maxActiveFields,
  onCreated,
}: {
  visible: boolean
  onClose: () => void
  activeCount: number
  maxActiveFields: number
  onCreated?: (field: CustomField) => void
}) {
  const queryClient = useQueryClient()
  const [label, setLabel] = useState('')
  const [fieldType, setFieldType] = useState<FieldType>('short_text')
  const [helpText, setHelpText] = useState('')
  const [optionsText, setOptionsText] = useState('')
  const [isRequired, setIsRequired] = useState(false)
  const [defaultValue, setDefaultValue] = useState('')
  const [error, setError] = useState<MobileApiError | null>(null)

  const remaining = maxActiveFields - activeCount
  const options = optionsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const needsOptions = fieldType === 'single_select'
  const canSubmit =
    label.trim().length > 0 && (!needsOptions || options.length > 0) && remaining > 0

  const create = useMutation({
    mutationFn: createCustomField,
    onSuccess: (field) => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setLabel('')
      setHelpText('')
      setOptionsText('')
      setIsRequired(false)
      setDefaultValue('')
      setError(null)
      onCreated?.(field)
      onClose()
    },
    onError: (mutationError: unknown) => {
      setError(mutationError instanceof MobileApiError ? mutationError : null)
    },
  })

  return (
    <Sheet
      visible={visible}
      title="Agregar columna"
      description={`Puedes tener hasta ${maxActiveFields} columnas activas. Tu borrador de producto se conserva.`}
      onClose={onClose}
      footer={
        <>
          <View style={styles.footerItem}>
            <PrimaryButton label="Cancelar" variant="secondary" onPress={onClose} />
          </View>
          <View style={styles.footerItem}>
            <PrimaryButton
              label="Guardar columna"
              loading={create.isPending}
              disabled={!canSubmit}
              onPress={() => {
                if (!canSubmit) return
                create.mutate({
                  label: label.trim(),
                  fieldType,
                  helpText: helpText.trim() || null,
                  isRequired,
                  isVisible: true,
                  isFilterable: false,
                  options: needsOptions
                    ? options.map((value) => ({ label: value }))
                    : null,
                  defaultValue: defaultValue.trim() || null,
                })
              }}
            />
          </View>
        </>
      }
    >
      {error ? <StatusMessage message={error.message} /> : null}
      <Text accessibilityRole="summary" style={styles.counter}>
        {activeCount} de {maxActiveFields} columnas activas
      </Text>
      {remaining <= 0 ? (
        <StatusMessage
          message={`Alcanzaste el máximo de ${maxActiveFields} columnas activas. Desactiva una desde la web para liberar cupo.`}
        />
      ) : null}

      <SheetField
        label="Etiqueta"
        value={label}
        maxLength={80}
        onChangeText={setLabel}
        help={`Identificador estable: ${previewKey(label) || '—'}`}
      />

      <OptionRow
        label="Tipo"
        value={fieldType}
        onChange={setFieldType}
        options={FIELD_TYPES.map((type) => ({
          value: type,
          label: fieldTypeLabels[type],
        }))}
      />

      {needsOptions ? (
        <SheetField
          label="Opciones"
          help="Una por línea"
          value={optionsText}
          multiline
          numberOfLines={3}
          onChangeText={setOptionsText}
        />
      ) : null}

      <SheetField
        label="Ayuda"
        help="Opcional"
        value={helpText}
        maxLength={160}
        onChangeText={setHelpText}
      />

      <Toggle label="Obligatoria" value={isRequired} onChange={setIsRequired} />

      {isRequired ? (
        <SheetField
          label="Valor para productos existentes"
          help="Una columna obligatoria necesita completar los productos ya creados."
          value={defaultValue}
          onChangeText={setDefaultValue}
        />
      ) : null}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  footerItem: { flex: 1 },
  counter: { color: colors.inkSoft, fontSize: 13 },
  toggle: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 48 },
  box: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 7,
    borderWidth: 1.5,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  boxChecked: { backgroundColor: colors.green, borderColor: colors.green },
  check: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  toggleLabel: { color: colors.ink, fontSize: 15, fontWeight: '600' },
})
