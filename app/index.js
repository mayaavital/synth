import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { useSpotifyAuth } from "../utils";
import { useNavigation } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import SpotifyConnectButton from "../components/SpotifyConnectButton";
import ResponsiveTitle from "../components/ResponsiveTitle";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

// Add web-specific styles to handle mobile viewport issues
if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = `
    html, body, #root {
      margin: 0;
      padding: 0;
      height: 100vh;
      height: 100dvh; /* Use dynamic viewport height for mobile */
      overflow: hidden;
      background-color: #1E1E1E;
    }
    
    /* Prevent mobile browser UI from affecting layout */
    @media screen and (max-width: 768px) {
      html {
        height: -webkit-fill-available;
      }
      body {
        min-height: 100vh;
        min-height: -webkit-fill-available;
      }
    }
  `;
  document.head.appendChild(style);
}

export default function App() {
  const router = useRouter();
  const navigation = useNavigation();
  const { token, authError, getSpotifyAuth } = useSpotifyAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  });
  // Font loading
  const [fontsLoaded] = useFonts({
    // we can add custom fonts here
    // 'ZenDots': require('../assets/fonts/ZenDots-Regular.ttf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Handle authentication process
  const handleSpotifyAuth = async () => {
    setIsAuthenticating(true);
    await getSpotifyAuth();
    setTimeout(() => {
      setIsAuthenticating(false);
    }, 1000); // Reset auth state after a short delay
  };

  // Handle navigation based on authentication state
  useEffect(() => {
    if (token) {
      console.log("Authentication successful, navigating to home");
      router.push("home");
    }
  }, [token, router]);

  // Wait for fonts to load
  if (!fontsLoaded) {
    return null;
  }

  // Conditional rendering
  let contentDisplayed = (
    <View style={styles.container} onLayout={onLayoutRootView}>
      {isAuthenticating ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C6E1B8" />
          <Text style={styles.loadingText}>Connecting to Spotify...</Text>
        </View>
      ) : (
        <View style={styles.centerContent}>
          <View style={styles.logoContainer}>
            <Image 
              source={require("../assets/newTitle.png")} 
              style={styles.responsiveLogo}
              resizeMode="contain"
            />
          </View>

          <SpotifyConnectButton
            onPress={handleSpotifyAuth}
            disabled={isAuthenticating}
            loading={isAuthenticating}
            style={{ width: windowWidth * 0.8 }}
          />
        </View>
      )}

      {authError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Authentication error. Please try again.
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {contentDisplayed}
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginBottom: 40, // Space between logo and button
  },
  responsiveLogo: {
    // For wide screens (desktop/tablet), limit max width but maintain responsiveness
    width: windowWidth > 768 
      ? Math.min(windowWidth * 0.6, 500)  // Desktop: 60% width or max 500px
      : windowWidth * 0.85,                // Mobile: 85% width
    
    // Height constraints for different screen sizes
    height: windowWidth > 768 
      ? Math.min(windowHeight * 0.25, 200)  // Desktop: 25% height or max 200px
      : Math.min(windowHeight * 0.18, 150), // Mobile: 18% height or max 150px
    
    // Additional constraints for very wide screens
    maxWidth: 600,
    maxHeight: 250,
    
    // Special handling for very small screens
    ...(windowWidth < 350 && {
      width: windowWidth * 0.9,
      height: windowHeight * 0.15,
    }),
    
    // Ensure proper scaling on very wide screens (ultra-wide monitors)
    ...(windowWidth > 1200 && {
      width: Math.min(windowWidth * 0.4, 600),
      height: Math.min(windowHeight * 0.3, 250),
    }),
  },
  loadingContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "rgba(255, 0, 0, 0.1)",
    borderRadius: 5,
  },
  errorText: {
    color: "#FF6B6B",
    textAlign: "center",
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
  },
});
