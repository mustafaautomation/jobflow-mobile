import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Jobflow',
  slug: 'jobflow',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'jobflow',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.quvantic.jobflow',
    supportsTablet: true,
    associatedDomains: ['applinks:jobflow-app.quvantic.com'],
    infoPlist: {
      NSCameraUsageDescription: 'Jobflow uses the camera so you can attach site photos to a job.',
      NSPhotoLibraryUsageDescription: 'Jobflow attaches job site photos from your library.',
    },
  },
  android: {
    package: 'com.quvantic.jobflow',
    adaptiveIcon: {
      backgroundColor: '#0E6B62',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    permissions: [],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'jobflow-app.quvantic.com', pathPrefix: '/' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    output: 'single',
    favicon: './assets/images/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0E6B62',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      'expo-notifications',
      {
        color: '#0E6B62',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Jobflow attaches job site photos from your library.',
        cameraPermission: 'Jobflow uses the camera so you can attach site photos to a job.',
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
    reactCompiler: false,
  },
  extra: {
    router: {},
  },
};

export default config;
