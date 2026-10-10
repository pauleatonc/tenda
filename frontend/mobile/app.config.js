/**
 * Expo config with optional Firebase Analytics plugins (GA4 app streams).
 * Provide google-services.json / GoogleService-Info.plist locally or via EAS
 * file secrets (gitignored). Without those files, native builds still work;
 * analytics stays a no-op until Firebase config is present.
 */
const fs = require('fs')
const path = require('path')

/** Expo project @pauleatonc/tenda — override with EAS_PROJECT_ID if needed. */
const EAS_PROJECT_ID =
  process.env.EAS_PROJECT_ID || '341e6f95-917f-4bfb-bd46-03a468a00e2e'

function resolveExisting(...candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue
    const abs = path.isAbsolute(candidate) ? candidate : path.join(__dirname, candidate)
    if (fs.existsSync(abs)) return abs
  }
  return null
}

const googleServicesJson = resolveExisting(
  process.env.GOOGLE_SERVICES_JSON,
  './google-services.json',
)
const googleServicesPlist = resolveExisting(
  process.env.GOOGLE_SERVICES_PLIST,
  './GoogleService-Info.plist',
)

const plugins = ['expo-router', 'expo-secure-store', 'expo-image']
if (googleServicesJson || googleServicesPlist) {
  plugins.push('@react-native-firebase/app', '@react-native-firebase/analytics')
}

module.exports = {
  name: 'Tenda',
  slug: 'tenda',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  scheme: 'tenda',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  plugins,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'cl.tenda.app',
    ...(googleServicesPlist ? { googleServicesFile: googleServicesPlist } : {}),
  },
  android: {
    package: 'cl.tenda.app',
    versionCode: 1,
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#ffffff',
    },
    ...(googleServicesJson ? { googleServicesFile: googleServicesJson } : {}),
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      ...(EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : {}),
    },
  },
}
