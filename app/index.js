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
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { useSpotifyAuth } from "../utils";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

export default function App() {
  const router = useRouter();
  const { token, authError, getSpotifyAuth } = useSpotifyAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

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
      router.push("/inGame");
    }
  }, [token, router]);

  // Wait for fonts to load
  if (!fontsLoaded) {
    return null;
  }

  // Conditional rendering
  let contentDisplayed = (
    <View style={styles.container} onLayout={onLayoutRootView}>
      <Image source={require("../assets/logo.png")} marginBottom={60} />

      {isAuthenticating ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C6E1B8" />
          <Text style={styles.loadingText}>Connecting to Spotify...</Text>
        </View>
      ) : (
        <>
          <Pressable
            style={styles.connectSpotify}
            onPress={handleSpotifyAuth}
            disabled={isAuthenticating}
          >
            <Text style={styles.text}>Login with Spotify</Text>
            <Image
              source={require("../assets/spotify-logo.png")}
              style={styles.spotifyLogo}
            />
          </Pressable>

          <Pressable
            style={styles.connectApple}
            marginTop={windowHeight * 0.01}
            onPress={handleSpotifyAuth}
            disabled={isAuthenticating}
          >
            <Text style={styles.text}>Login with Apple Music</Text>
            <Image
              source={require("../assets/apple-music.png")}
              style={styles.spotifyLogo}
            />
          </Pressable>
        </>
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
  connectSpotify: {
    backgroundColor: "#C6E1B8",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderRadius: (windowHeight * 0.1) / 2,
    height: windowHeight * 0.08,
    width: windowWidth * 0.7,
    paddingHorizontal: windowWidth * 0.05,
    elevation: 5,
  },
  connectApple: {
    backgroundColor: "#F1D5EE",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderRadius: (windowHeight * 0.1) / 2,
    height: windowHeight * 0.08,
    width: windowWidth * 0.7,
    paddingHorizontal: windowWidth * 0.05,
    elevation: 5,
  },
  spotifyLogo: {
    height: windowWidth * 0.08,
    width: windowWidth * 0.08,
    resizeMode: "contain",
  },
  synth_container: {
    backgroundColor: "#C6B6DD",
    height: windowWidth * 0.3,
    width: windowWidth * 0.6,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: windowWidth * 0.15,
    borderRadius: 20,
  },
  synth_text: {
    fontSize: 24,
    fontWeight: "bold",
  },
  text: {
    color: "#1E1E1E",
    fontSize: 16,
    fontWeight: "500",
  },
});
