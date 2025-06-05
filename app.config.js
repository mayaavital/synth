import 'dotenv/config';

export default {
  expo: {
    name: "synth",
    slug: "synth",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.csprout3.synth",
      buildNumber: "2"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.csprout3.synth"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-router"
    ],
    extra: {
      eas: {
        projectId: "46bebf1a-7fc4-46f1-9775-5d8b7920712e"
      },
      // Firebase Configuration
      FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
      FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
      FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL,
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
      FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
      FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
      FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID,
      
      // Spotify Configuration
      SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || '44bc87fe29004136b77183319f56338e',
      SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI || 'exp://10.32.120.199:8083/--/callback',
      
      // Environment info
      NODE_ENV: process.env.NODE_ENV || 'development',
      IS_PRODUCTION: process.env.NODE_ENV === 'production'
    }
  }
}; 