import { useEffect, useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'

const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ''

export function mobileTurnstileEnabled() {
  return Boolean(SITE_KEY)
}

export function MobileTurnstile({ onToken }: { onToken: (token: string) => void }) {
  const html = useMemo(
    () => `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  </head>
  <body style="margin:0;display:flex;justify-content:center;background:transparent">
    <div class="cf-turnstile" data-sitekey="${SITE_KEY}" data-theme="light" data-callback="onToken"></div>
    <script>
      function onToken(token) {
        window.ReactNativeWebView.postMessage(token)
      }
    </script>
  </body>
</html>`,
    [],
  )

  useEffect(() => {
    if (!SITE_KEY) onToken('local-development')
  }, [onToken])

  if (!SITE_KEY) return null
  return (
    <WebView
      javaScriptEnabled
      originWhitelist={['*']}
      source={{ html, baseUrl: 'http://localhost' }}
      style={styles.widget}
      onMessage={(event) => onToken(event.nativeEvent.data)}
    />
  )
}

const styles = StyleSheet.create({
  widget: {
    backgroundColor: 'transparent',
    height: 80,
    width: '100%',
  },
})
