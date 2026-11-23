import { Stack } from 'expo-router'

import { colors } from '../../components/auth-ui'

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="mas/perfil"
        options={{
          headerShown: true,
          title: 'Cuenta',
          headerBackTitle: 'Cuenta',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.ink,
          headerTitleStyle: { color: colors.ink, fontWeight: '800' },
        }}
      />
    </Stack>
  )
}
