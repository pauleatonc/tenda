import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

const GOOGLE_G =
  'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.png'

type Props = {
  loading?: boolean
  onPress: () => void
}

export function GoogleSignInButton({ loading = false, onPress }: Props) {
  return (
    <Pressable
      accessibilityLabel="Iniciar sesión con Google"
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        loading && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri: GOOGLE_G }}
              style={styles.icon}
            />
          </View>
          <Text style={styles.label}>Iniciar sesión con Google</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#4285f4',
    borderRadius: 1,
    elevation: 3,
    height: 50,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    width: 240,
  },
  pressed: { backgroundColor: '#3367d6' },
  disabled: { opacity: 0.65 },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 50,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  icon: {
    height: 18,
    width: 18,
  },
  label: {
    color: '#ffffff',
    flex: 1,
    fontFamily: Platform.OS === 'android' ? 'Roboto' : 'System',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.21,
    textAlign: 'center',
  },
})
