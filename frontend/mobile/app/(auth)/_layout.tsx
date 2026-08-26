import { Stack } from 'expo-router'

import { colors } from '../../components/auth-ui'

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Atrás',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen
        name="login"
        options={{ headerShown: false, title: 'Iniciar sesión' }}
      />
      <Stack.Screen name="registro" options={{ title: 'Crear cuenta' }} />
      <Stack.Screen name="recuperar" options={{ title: 'Recuperar acceso' }} />
      <Stack.Screen name="verificar" options={{ title: 'Verificar correo' }} />
    </Stack>
  )
}
