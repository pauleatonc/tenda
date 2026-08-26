import { Tabs } from 'expo-router'
import { Text } from 'react-native'

import { colors } from '../../../components/auth-ui'

const icons: Record<string, string> = {
  index: '⌂',
  inventario: '□',
  ventas: '↗',
  despachos: '◇',
  mas: '•••',
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.paper },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 18, fontWeight: '800' }}>
            {icons[route.name] ?? '•'}
          </Text>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="inventario" options={{ title: 'Inventario' }} />
      <Tabs.Screen name="ventas" options={{ title: 'Ventas' }} />
      <Tabs.Screen name="despachos" options={{ title: 'Despachos' }} />
      <Tabs.Screen name="mas" options={{ title: 'Más' }} />
    </Tabs>
  )
}
