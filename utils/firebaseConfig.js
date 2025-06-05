import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";
import Constants from "expo-constants";

// Get Firebase configuration from environment variables via Expo Constants
const getFirebaseConfig = () => {
  const config = Constants.expoConfig?.extra;
  
  if (!config) {
    throw new Error("Firebase configuration not found in app config");
  }

  return {
    apiKey: config.FIREBASE_API_KEY,
    authDomain: config.FIREBASE_AUTH_DOMAIN,
    databaseURL: config.FIREBASE_DATABASE_URL,
    projectId: config.FIREBASE_PROJECT_ID,
    storageBucket: config.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: config.FIREBASE_MESSAGING_SENDER_ID,
    appId: config.FIREBASE_APP_ID,
    measurementId: config.FIREBASE_MEASUREMENT_ID,
  };
};

// Initialize Firebase app
let app;
let db;
let analytics;

try {
  const firebaseConfig = getFirebaseConfig();
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  
  // Analytics is only available on web
  if (typeof window !== 'undefined') {
    analytics = getAnalytics(app);
  }
} catch (error) {
  console.error("Error initializing Firebase:", error);
  throw error;
}

export { app, db, analytics };
export default { app, db, analytics }; 