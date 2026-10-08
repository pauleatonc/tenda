/**
 * Expo config with Firebase Analytics plugins (GA4 app streams).
 * Provide google-services.json / GoogleService-Info.plist via EAS file secrets
 * (gitignored). Without those files, Expo Go still runs; analytics is a no-op
 * until a native build includes the Firebase config.
 */
module.exports = {
  name: 'Tenda',
  slug: 'tenda',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  scheme: 'tenda',
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-image',
    '@react-native-firebase/app',
    '@react-native-firebase/analytics',
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'cl.tenda.app',
    googleServicesFile: process.env.GOOGLE_SERVICES_PLIST || './GoogleService-Info.plist',
  },
  android: {
    package: 'cl.tenda.app',
    predictiveBackGestureEnabled: false,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
  },
  web: {
    bundler: 'metro',
  },
  experiments: {
    typedRoutes: true,
  },
}
