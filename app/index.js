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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center"}}>
        <Image source={require("../assets/newTitle.png")}></Image>
      </View>

      {isAuthenticating ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C6E1B8" />
          <Text style={styles.loadingText}>Connecting to Spotify...</Text>
        </View>
      ) : (
        <View style={{ justifyContent: "center", alignItems: "center" }}>
          <SpotifyConnectButton
            onPress={handleSpotifyAuth}
            disabled={isAuthenticating}
            loading={isAuthenticating}
            style={{ width: windowWidth * 0.8, marginBottom: 20 }}
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
    justifyContent: "space-around",
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
});
