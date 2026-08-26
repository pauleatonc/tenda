import type { ReactNode, Ref } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'

import { colors } from './auth-ui'

/**
 * Bottom sheet used for filters, stock adjustments and column creation. A
 * native `Modal` keeps the screen reader focus trapped without extra deps.
 */
export function Sheet({
  visible,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  visible: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={sheetStyles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onClose}
          style={sheetStyles.backdropTouchable}
        />
        <View style={sheetStyles.sheet}>
          <View style={sheetStyles.grabber} />
          <Text accessibilityRole="header" style={sheetStyles.title}>
            {title}
          </Text>
          {description ? (
            <Text style={sheetStyles.description}>{description}</Text>
          ) : null}
          <ScrollView
            contentContainerStyle={sheetStyles.body}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? <View style={sheetStyles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  )
}

export function InventoryChip({
  label,
  tone = 'neutral',
  onPress,
  selected = false,
}: {
  label: string
  tone?: 'available' | 'reserved' | 'warning' | 'neutral'
  onPress?: () => void
  selected?: boolean
}) {
  const content = (
    <Text
      style={[
        chipStyles.text,
        chipStyles[`${tone}Text`],
        selected && chipStyles.selectedText,
      ]}
    >
      {label}
    </Text>
  )
  if (!onPress) {
    return <View style={[chipStyles.chip, chipStyles[tone]]}>{content}</View>
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        chipStyles.chip,
        chipStyles[tone],
        selected && chipStyles.selected,
        pressed && chipStyles.pressed,
      ]}
    >
      {content}
    </Pressable>
  )
}

export function SheetField({
  label,
  error,
  help,
  ref,
  ...inputProps
}: TextInputProps & {
  label: string
  error?: string
  help?: string
  ref?: Ref<TextInput>
}) {
  return (
    <View style={fieldStyles.field}>
      <Text style={fieldStyles.label}>{label}</Text>
      {help ? <Text style={fieldStyles.help}>{help}</Text> : null}
      <TextInput
        {...inputProps}
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.inkMuted}
        style={[fieldStyles.input, Boolean(error) && fieldStyles.inputError]}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={fieldStyles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

/** Radio-style option list: taller targets than a picker and readable labels. */
export function OptionRow<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string
  options: { value: T; label: string; disabled?: boolean; hint?: string }[]
  value: T
  onChange: (next: T) => void
  error?: string
}) {
  return (
    <View style={fieldStyles.field}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={fieldStyles.options}>
        {options.map((option) => {
          const selected = option.value === value
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: option.disabled }}
              accessibilityLabel={option.label}
              accessibilityHint={option.hint}
              disabled={option.disabled}
              onPress={() => onChange(option.value)}
              style={[
                fieldStyles.option,
                selected && fieldStyles.optionSelected,
                option.disabled && fieldStyles.optionDisabled,
              ]}
            >
              <Text
                style={[
                  fieldStyles.optionText,
                  selected && fieldStyles.optionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={fieldStyles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

export function SectionCard({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <View style={sectionStyles.card}>
      <View style={sectionStyles.header}>
        <Text accessibilityRole="header" style={sectionStyles.title}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  )
}

const sheetStyles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(23, 32, 29, 0.35)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTouchable: { flex: 1 },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    gap: 8,
    maxHeight: '88%',
    paddingBottom: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: colors.line,
    borderRadius: 999,
    height: 4,
    marginBottom: 10,
    width: 44,
  },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  description: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  body: { gap: 16, paddingBottom: 12, paddingTop: 14 },
  footer: { flexDirection: 'row', gap: 12, paddingTop: 6 },
})

const chipStyles = StyleSheet.create({
  chip: {
    borderColor: 'transparent',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  available: { backgroundColor: colors.greenPale },
  reserved: { backgroundColor: '#e7e3f4' },
  warning: { backgroundColor: '#f4e5b7' },
  neutral: { backgroundColor: '#eceae3' },
  selected: { backgroundColor: colors.green, borderColor: colors.green },
  pressed: { opacity: 0.8 },
  text: { fontSize: 12, fontWeight: '700' },
  availableText: { color: colors.green },
  reservedText: { color: '#4a3d7a' },
  warningText: { color: '#765c17' },
  neutralText: { color: colors.inkSoft },
  selectedText: { color: '#ffffff' },
})

const fieldStyles = StyleSheet.create({
  field: { gap: 7 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  help: { color: colors.inkSoft, fontSize: 13, lineHeight: 18 },
  input: {
    backgroundColor: colors.surface,
    borderColor: '#c9c6bc',
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputError: { borderColor: colors.error },
  error: { color: colors.error, fontSize: 13, lineHeight: 18 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  optionSelected: { backgroundColor: colors.greenPale, borderColor: colors.green },
  optionDisabled: { opacity: 0.48 },
  optionText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  optionTextSelected: { color: colors.green, fontWeight: '800' },
})

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  title: { color: colors.ink, fontSize: 17, fontWeight: '800' },
})
