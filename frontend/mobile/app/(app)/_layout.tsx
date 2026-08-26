import { Stack } from 'expo-router'

import { colors } from '../../components/auth-ui'

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
      }}
    />
  )
}
