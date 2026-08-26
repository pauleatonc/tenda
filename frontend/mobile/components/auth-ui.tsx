import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export const colors = {
  paper: '#f7f5ef',
  surface: '#ffffff',
  ink: '#17201d',
  inkSoft: '#5e6763',
  inkMuted: '#89918d',
  green: '#175c4d',
  greenPale: '#e2efe9',
  line: '#dedbd1',
  error: '#9c321f',
  errorPale: '#fbeae6',
}

export function AuthScaffold({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.wordmark}>tenda</Text>
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Text style={styles.description}>{description}</Text>
          </View>
          <View style={styles.card}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export function FormField({
  label,
  error,
  secureTextEntry,
  ...inputProps
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        accessibilityState={{ disabled: inputProps.editable === false }}
        placeholderTextColor={colors.inkMuted}
        secureTextEntry={secureTextEntry}
        style={[styles.input, Boolean(error) && styles.inputError]}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

export function PrimaryButton({
  label,
  loading = false,
  disabled = false,
  onPress,
  variant = 'primary',
}: {
  label: string
  loading?: boolean
  disabled?: boolean
  onPress: () => void
  variant?: 'primary' | 'secondary'
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        pressed && styles.buttonPressed,
        (disabled || loading) && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#ffffff' : colors.green} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'secondary' && styles.buttonTextSecondary,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

export function StatusMessage({
  message,
  kind = 'error',
}: {
  message: string
  kind?: 'error' | 'success'
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={kind === 'error' ? 'alert' : 'summary'}
      style={[styles.message, kind === 'success' && styles.messageSuccess]}
    >
      <Text style={[styles.messageText, kind === 'success' && styles.messageTextSuccess]}>
        {message}
      </Text>
    </View>
  )
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: colors.paper, flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  wordmark: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  heading: { marginBottom: 28, marginTop: 48 },
  eyebrow: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1.3,
    lineHeight: 44,
  },
  description: {
    color: colors.inkSoft,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 22,
    borderWidth: 1,
    gap: 16,
    padding: 20,
  },
  field: { gap: 7 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  input: {
    backgroundColor: colors.surface,
    borderColor: '#c9c6bc',
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: 13, lineHeight: 18 },
  button: {
    alignItems: 'center',
    backgroundColor: colors.green,
    borderColor: colors.green,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.line },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.58 },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  buttonTextSecondary: { color: colors.green },
  message: {
    backgroundColor: colors.errorPale,
    borderColor: '#edc6bc',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  messageSuccess: { backgroundColor: colors.greenPale, borderColor: '#c2dbd1' },
  messageText: { color: colors.error, lineHeight: 20 },
  messageTextSuccess: { color: colors.green },
  link: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '700',
    minHeight: 44,
    paddingVertical: 12,
    textAlign: 'center',
  },
  divider: {
    color: colors.inkMuted,
    fontSize: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
})
