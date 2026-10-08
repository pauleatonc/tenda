import { useQuery } from '@tanstack/react-query'
import { Tabs } from 'expo-router'
import { Text, View } from 'react-native'

import { AuthImage } from '../../../components/auth-image'
import { colors } from '../../../components/auth-ui'
import { getMobileViewer } from '../../../lib/auth-api'

const icons: Record<string, string> = {
  index: '⌂',
  inventario: '□',
  ventas: '↗',
  despachos: '◇',
  mas: '•••',
}

function StoreTitle() {
  const viewer = useQuery({
    queryKey: ['mobile-viewer'],
    queryFn: getMobileViewer,
    retry: false,
    staleTime: 10 * 60_000,
  })
  const name = viewer.data?.organisation.name ?? 'Tienda'
  const logoUrl = viewer.data?.organisation.logoUrl
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8, maxWidth: 240 }}>
      {logoUrl ? (
        <AuthImage
          uri={logoUrl}
          style={{ borderRadius: 8, height: 28, width: 28 }}
          placeholder={
            <Text style={{ color: colors.green, fontWeight: '800' }}>
              {name.slice(0, 1).toUpperCase()}
            </Text>
          }
        />
      ) : (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: colors.greenPale,
            borderRadius: 8,
            height: 28,
            justifyContent: 'center',
            width: 28,
          }}
        >
          <Text style={{ color: colors.green, fontWeight: '800' }}>
            {name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      <Text
        numberOfLines={1}
        style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}
      >
        {name}
      </Text>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.paper },
        headerShadowVisible: false,
        headerTitle: () => <StoreTitle />,
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
