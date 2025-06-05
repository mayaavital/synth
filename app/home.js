import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import useSpotifyAuth from "../utils/SpotifyAuthContext";
import SpotifyConnectButton from "../components/SpotifyConnectButton";
import AlbumCarousel from "../components/AlbumCarousel";
import { getDatabase, ref, child, get, set } from "firebase/database";
import { getAnalytics, logEvent } from "firebase/analytics";
import { db, analytics } from "../utils/firebaseConfig";

var {
  GameDataBranches,
  UserDataBranches,
  DATABASE_BRANCHES,
} = require("../server/database-branches");

// Use the centralized Firebase instances
// var app = initializeApp(firebaseConfig);
// var db = getDatabase(app);

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
      background-color: #8E44AD;
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

export default function home() {
  const navigation = useNavigation();
  const router = useRouter();
  const {
    token,
    authError,
    getSpotifyAuth,
    logout,
    isInitialized,
    isTokenValid,
    getValidToken,
  } = useSpotifyAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [tokenStatus, setTokenStatus] = useState("unknown");

  // Check token validity and set status
  const checkTokenStatus = async () => {
    console.log("=== HOME SCREEN TOKEN DEBUG ===");
    console.log("token from hook:", !!token);
    console.log("token length:", token ? token.length : 0);
    console.log("isTokenValid():", isTokenValid());

    // Check AsyncStorage directly from home screen
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const storedToken = await AsyncStorage.getItem('spotify_access_token');
      const storedExpiration = await AsyncStorage.getItem('spotify_token_expiration');
      const storedRefreshToken = await AsyncStorage.getItem('spotify_refresh_token');
      console.log("HOME - AsyncStorage token exists:", !!storedToken);
      console.log("HOME - AsyncStorage token length:", storedToken ? storedToken.length : 0);
      console.log("HOME - AsyncStorage expiration:", storedExpiration);
      console.log("HOME - AsyncStorage refresh token exists:", !!storedRefreshToken);
    } catch (error) {
      console.error("Error checking AsyncStorage from home:", error);
    }
    console.log("=== END HOME SCREEN TOKEN DEBUG ===");

    if (!token) {
      setTokenStatus("none");
      return;
    }

    if (isTokenValid()) {
      setTokenStatus("valid");
    } else {
      try {
        // Try to refresh the token
        const newToken = await getValidToken();
        if (newToken) {
          setTokenStatus("valid");
        } else {
          setTokenStatus("expired");
        }
      } catch (error) {
        console.error("Error refreshing token:", error);
        setTokenStatus("expired");
      }
    }
  };

  // Check if we have an auth error
  useEffect(() => {
    if (authError) {
      setIsAuthenticating(false);
      Alert.alert(
        "Authentication Error",
        `There was an error connecting to Spotify: ${authError}`
      );
      console.error("Spotify auth error:", authError);
    }
  }, [authError]);

  // Handle authentication status changes and check token validity
  useEffect(() => {
    if (token) {
      console.log("User has a Spotify token");
      setIsAuthenticating(false);
      checkTokenStatus();
    } else {
      setTokenStatus("none");
    }
  }, [token]);

  // Check token status when component mounts or when isInitialized changes
  useEffect(() => {
    if (isInitialized) {
      checkTokenStatus();
    }
  }, [isInitialized]);

  // Start Spotify authentication
  const handleConnectSpotify = async () => {
    setIsAuthenticating(true);
    try {
      console.log("Starting Spotify authentication...");
      await getSpotifyAuth();
    } catch (error) {
      console.error("Error starting auth:", error);
      setIsAuthenticating(false);
      Alert.alert(
        "Authentication Failed",
        "There was a problem connecting to Spotify. Please try again."
      );
    }
  };

  // Handle refreshing expired token
  const handleRefreshToken = async () => {
    try {
      setIsAuthenticating(true);
      const newToken = await getValidToken();
      if (newToken) {
        setTokenStatus("valid");
        Alert.alert("Success", "Your Spotify connection has been refreshed.");
      } else {
        // If refresh fails, prompt for re-authentication
        await handleConnectSpotify();
      }
    } catch (error) {
      console.error("Error refreshing token:", error);
      Alert.alert(
        "Refresh Failed",
        "Could not refresh your Spotify session. Please reconnect."
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      setTokenStatus("none");
      Alert.alert("Logged Out", "You have been disconnected from Spotify.");
    } catch (error) {
      console.error("Error logging out:", error);
      Alert.alert("Error", "Failed to log out. Please try again.");
    }
  };

  // Get user-friendly token status message
  const getTokenStatusMessage = () => {
    if (!isInitialized) return "Checking connection...";

    switch (tokenStatus) {
      case "valid":
        return "Connected to Spotify";
      case "expired":
        return "Spotify token expired";
      case "none":
        return "Not connected to Spotify";
      default:
        return "Unknown connection status";
    }
  };

  // Hide default header and use our custom one
  useEffect(() => {
    navigation.setOptions({
      header: (props) => (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => {
              console.log("Menu button pressed!"); // Debug log
              console.log("Token status:", !!token); // Debug log

              if (token) {
                console.log("Showing sign out alert"); // Debug log
                Alert.alert(
                  "Sign Out",
                  "Would you like to sign out of Spotify?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Sign Out",
                      onPress: async () => {
                        console.log("Sign out confirmed"); // Debug log
                        await handleLogout();
                        router.replace("/");
                      },
                      style: "destructive",
                    },
                  ]
                );
              } else {
                console.log("Showing connect alert"); // Debug log
                Alert.alert(
                  "Not Connected",
                  "You are not connected to Spotify. Would you like to connect?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Connect",
                      onPress: () => {
                        console.log("Connect confirmed"); // Debug log
                        router.replace("/");
                      },
                    },
                  ]
                );
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={28} color="white" />
          </TouchableOpacity>

          <View style={styles.headerLogoContainer}>
            <Image source={require("../assets/SYNTH.png")} style={styles.logo} />
          </View>

          <View style={styles.placeholder} />
        </View>
      ),
    });
  }, [navigation, token]);

  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Spotify Connection Status */}
        <View style={styles.spotifyStatus}>
          {!isInitialized ? (
            <ActivityIndicator size="small" color="#1DB954" />
          ) : (
            <>
              <View style={styles.statusLine}>
                <View
                  style={[
                    styles.statusDot,
                    tokenStatus === "valid"
                      ? styles.statusConnected
                      : tokenStatus === "expired"
                        ? styles.statusWarning
                        : styles.statusDisconnected,
                  ]}
                />
                <Text style={styles.spotifyStatusText}>
                  {getTokenStatusMessage()}
                </Text>
              </View>

              {token ? (
                tokenStatus === "expired" ? (
                  // Show refresh button for expired tokens
                  <TouchableOpacity
                    style={styles.spotifyRefreshButton}
                    onPress={handleRefreshToken}
                    disabled={isAuthenticating}
                  >
                    {isAuthenticating ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Ionicons
                          name="refresh"
                          size={20}
                          color="white"
                          style={styles.refreshIcon}
                        />
                        <Text style={styles.refreshText}>Refresh Connection</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  // Show disconnect button for valid tokens
                  <TouchableOpacity
                    style={styles.spotifyDisconnectButton}
                    onPress={handleLogout}
                  >
                    <Text style={styles.disconnectText}>Disconnect</Text>
                  </TouchableOpacity>
                )
              ) : (
                // Show connect button when no token
                <SpotifyConnectButton
                  onPress={handleConnectSpotify}
                  disabled={isAuthenticating}
                  loading={isAuthenticating}
                  style={{ width: '90%' }}
                />
              )}
            </>
          )}
        </View>

        {/* Game options */}
        <View style={styles.cardContainer}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/multiplayer-game")}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="wifi" size={32} color="white" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardTitle}>Multiplayer Mode</Text>
              <Text style={styles.cardSubtitle}>
                Play with friends on the same WiFi network in real-time.
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => {
              if (tokenStatus !== "valid") {
                Alert.alert(
                  "Spotify Required",
                  "Please connect to Spotify to use Solo Discovery mode.",
                  [{ text: "OK" }]
                );
                return;
              }
              router.push("/solo-discovery");
            }}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="musical-notes" size={32} color="white" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardTitle}>Solo Discovery</Text>
              <Text style={styles.cardSubtitle}>
                Discover new music based on your top tracks or specific songs you love. Explore albums and artists you haven't heard before.
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={async () => {
              const prevGameRef = ref(db, `${DATABASE_BRANCHES.ANALYTICS}/previous_game`);

              get(prevGameRef).then((snapshot) => {
                if (snapshot.exists()) {
                  const value = snapshot.val()["value"];
                  set(prevGameRef, { value: value + 1 });
                } else {
                  set(prevGameRef, { value: 0 });
                }
              }).catch((error) => {
                console.error(error);
              });
              /*
              const dbRef = getDatabase();

              get(child(dbRef, `${DATABASE_BRANCHES.ANALYTICS}/${"previous_game"}`)).then((snapshot) => {
                if (snapshot.exists()) {
                  console.log(snapshot.val()["value"]);

                  var value = snapshot.val()["value"];

                  set(ref(dbRef,  `${DATABASE_BRANCHES.ANALYTICS}/${"previous_game"}`), {
                    "value": value + 1,
                  });

                } else {
                  console.log("No data available");
                  set(ref(dbRef,  `${DATABASE_BRANCHES.ANALYTICS}/${"previous_game"}`), {
                    "value": 0,
                  });
                }
              }).catch((error) => {
                console.error(error);
              });
              */
              router.push("/previous-games");
            }}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="play-back-circle-outline" size={32} color="white" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardTitle}>Previous Games</Text>
              <Text style={styles.cardSubtitle}>
                See how you and your friends did on previous games.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Album Carousel */}
        {token && tokenStatus === "valid" && (
          <AlbumCarousel />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: "#8E44AD", // Use header color to eliminate white gaps
  },
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: "#8E44AD", // Purple background for header
    paddingVertical: 5, // Reduced from 10
    paddingHorizontal: 16,
    height: Math.max(80, windowHeight * 0.08), // Reduced height: 80px minimum or 8% of screen height
    paddingTop: Math.max(5, windowHeight * 0.03), // Reduced top padding: 5px minimum or 3% of screen height
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 7,
    elevation: 5,
  },
  menuButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogoContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 80, // Give space for menu button and potential right content
  },
  logoText: {
    color: "#FFC857", // Golden yellow color
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  logo: {
    height: Math.min(windowHeight * 0.06, 60), // Responsive height
    width: Math.min(windowWidth * 0.4, 200),   // Responsive width
    resizeMode: "contain",
  },
  placeholder: {
    width: 40,
  },
  spotifyStatus: {
    margin: 20,
    padding: 15,
    backgroundColor: "transparent",
    borderRadius: 10,
    alignItems: "center",
    // shadowColor: "#000000",
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.2,
    // shadowRadius: 3,
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 6,
    marginRight: 10,
  },
  statusConnected: {
    backgroundColor: "#1DB954", // Spotify green
    shadowColor: "#1DB954",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 9,
    elevation: 10,
  },
  statusDisconnected: {
    backgroundColor: "#e74c3c", // Red
  },
  statusWarning: {
    backgroundColor: "#FFC857", // Yellow warning color
  },
  spotifyStatusText: {
    color: "white",
    fontSize: 16,
  },
  spotifyDisconnectButton: {
    backgroundColor: "#444",
    padding: 10,
    borderRadius: 25,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#444",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  spotifyRefreshButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFC857", // Yellow matching the warning dot
    padding: 10,
    borderRadius: 25,
    paddingHorizontal: 20,
  },
  refreshIcon: {
    marginRight: 8,
  },
  refreshText: {
    color: "#000",
    fontWeight: "bold",
  },
  disconnectText: {
    color: "#e74c3c",
    fontWeight: "bold",
  },
  title: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  cardContainer: {
    padding: 20,
    gap: 20,
  },
  card: {
    backgroundColor: "#8E44AD",
    borderRadius: 50,
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    // borderWidth: 1,
    // borderColor: "#8E44AD",
    shadowColor: "#542866", // light purple
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 2,
  },
  iconContainer: {
    backgroundColor: "#8E44AD",
    borderRadius: 16,
    padding: 10,
    marginRight: 20,
    marginLeft: 10,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  cardSubtitle: {
    color: "#d1d5db",
    marginTop: 4,
    fontSize: 14,
  },
  albumNoteText: {
    color: "#d1d5db",
    marginTop: 15,
    fontSize: 14,
    textAlign: "center",
    padding: 10,
  },
  gameModeSection: {
    margin: 20,
    padding: 15,
    backgroundColor: "#282828",
    borderRadius: 10,
  },
  gameModeTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  gameCardContainer: {
    gap: 15,
  },
  gameCard: {
    backgroundColor: "#333",
    borderRadius: 10,
    padding: 15,
  },
  gameCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gameCardTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  gameCardTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  gameCardDescription: {
    color: "#d1d5db",
    marginTop: 4,
    fontSize: 12,
  },
  gameNoteText: {
    color: "#d1d5db",
    marginTop: 15,
    fontSize: 12,
    textAlign: "center",
  },
});
