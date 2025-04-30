import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useSpotifyAuth } from "../utils";

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
              if (token) {
                Alert.alert(
                  "Spotify Connected",
                  "Do you want to disconnect from Spotify?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Disconnect",
                      onPress: handleLogout,
                      style: "destructive",
                    },
                  ]
                );
              } else {
                Alert.alert(
                  "Not Connected",
                  "You are not connected to Spotify."
                );
              }
            }}
          >
            <Ionicons name="menu" size={28} color="white" />
          </TouchableOpacity>

          <Image source={require("../assets/SYNTH.png")} style={styles.logo} />

          <View style={styles.placeholder} />
        </View>
      ),
    });
  }, [navigation, token]);

  return (
    // <LinearGradient colors={["#040306", "#131624"]} style={{ flex: 1 }}>
    <SafeAreaView style={{ backgroundColor: "#1E1E1E", flex: 1 }}>
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
              <TouchableOpacity
                style={styles.spotifyConnectButton}
                onPress={handleConnectSpotify}
                disabled={isAuthenticating}
              >
                {isAuthenticating ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Image
                      source={require("../assets/white-spotify-logo.png")}
                      style={styles.spotifyIcon}
                    />
                    <Text style={styles.spotifyConnectText}>
                      Connect to Spotify
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Game options */}
      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/create-game")}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="add-circle" size={32} color="white" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.cardTitle}>Create a new game</Text>
            <Text style={styles.cardSubtitle}>
              Invite your friends, guess the listener, and create playlists.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/join-game")}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="people" size={32} color="white" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.cardTitle}>Join a game</Text>
            <Text style={styles.cardSubtitle}>
              Join a game that your friend already created.
            </Text>
          </View>
        </TouchableOpacity>
        
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

        <TouchableOpacity style={styles.card}>
          <View
            style={styles.iconContainer}
            onPress={() => alert("sorry this feature isn't available yet!")}
          >
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
    </SafeAreaView>
    // </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: "#8E44AD", // Purple background for header
    paddingVertical: 10,
    paddingHorizontal: 16,
    height: 100,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 7,
    elevation: 5,
  },
  // menuButton: {
  //   padding: 8,
  // },
  logoText: {
    color: "#FFC857", // Golden yellow color
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  logo: {
    height: 35,
    width: 110,
    resizeMode: "contain",
  },
  placeholder: {
    height: window.innerHeight * 0.05,
  },
  spotifyStatus: {
    margin: 20,
    padding: 15,
    backgroundColor: "#282828",
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
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
  spotifyConnectButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1DB954", // Spotify green
    padding: 12,
    borderRadius: 25,
    paddingHorizontal: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  spotifyDisconnectButton: {
    backgroundColor: "#333",
    padding: 10,
    borderRadius: 25,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#666",
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
  spotifyIcon: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  spotifyConnectText: {
    color: "white",
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
    backgroundColor: "#000000",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    shadowColor: "#C6B6DD", // light purple
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
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
