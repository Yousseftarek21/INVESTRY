import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'INVSTRY',
  slug: 'mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'mobile',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/images/icon.png',
    resizeMode: 'contain',
    backgroundColor: '#060D1A',
  },
  ios: { supportsTablet: false },
  android: {},
  web: { favicon: './assets/images/icon.png' },
  plugins: [
    ['expo-router', { origin: 'https://replit.com/' }],
    'expo-font',
    'expo-web-browser',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    // Injected at dev-server start time so native Expo Go can reach the API
    apiBaseUrl: process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'http://localhost:80',
  },
});
