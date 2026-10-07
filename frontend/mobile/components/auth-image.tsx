import { Image, type ImageStyle, type StyleProp } from 'expo-image'
import { useEffect, useState } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { getStoredToken } from '../lib/auth-api'
import { colors } from './auth-ui'

type AuthImageProps = {
  uri: string | null | undefined
  style?: StyleProp<ImageStyle>
  contentFit?: 'cover' | 'contain' | 'fill'
  placeholder?: React.ReactNode
}

/**
 * Authenticated media via expo-image disk/memory cache + Bearer header.
 */
export function AuthImage({
  uri,
  style,
  contentFit = 'cover',
  placeholder,
}: AuthImageProps) {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    let cancelled = false
    void getStoredToken().then((token) => {
      if (cancelled) return
      setHeaders(token ? { Authorization: `Bearer ${token}` } : {})
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!uri || headers === null) {
    return placeholder ? (
      <View style={[styles.fallback, style as StyleProp<ViewStyle>]}>{placeholder}</View>
    ) : null
  }

  if (!headers.Authorization) {
    return placeholder ? (
      <View style={[styles.fallback, style as StyleProp<ViewStyle>]}>{placeholder}</View>
    ) : null
  }

  return (
    <Image
      source={{ uri, headers }}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={120}
    />
  )
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    backgroundColor: colors.line,
    justifyContent: 'center',
    overflow: 'hidden',
  },
})
