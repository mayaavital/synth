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
  const { token, authError, getSpotifyAuth, logout, isInitialized } =
    useSpotifyAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Check if we have an auth error
  useEffect(() => {
    if (authError) {
      Alert.alert(
        "Authentication Error",
        "There was an error connecting to Spotify. Please try again."
      );
      console.error("Spotify auth error:", authError);
    }
  }, [authError]);

  // Handle authentication status changes
  useEffect(() => {
    if (token) {
      console.log("User is authenticated with Spotify");
      setIsAuthenticating(false);
    }
  }, [token]);

  // Start Spotify authentication
  const handleConnectSpotify = async () => {
    setIsAuthenticating(true);
    try {
      await getSpotifyAuth();
    } catch (error) {
      console.error("Error starting auth:", error);
      setIsAuthenticating(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      Alert.alert("Logged Out", "You have been disconnected from Spotify.");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };
  // Hide default header and use our custom one
  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitleStyle: {
        color: "#FFC857", // Golden yellow color
        fontSize: 28,
        fontWeight: "bold",
        letterSpacing: 2,
      },
      headerStyle: { backgroundColor: "#8E44AD" },
      headerLeft: () => (
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
              Alert.alert("Not Connected", "You are not connected to Spotify.");
            }
          }}
        >
          <Ionicons name="menu" size={28} color="white" />
        </TouchableOpacity>
      ),
      title: "SYNTH",
    });
  }, [navigation]);

  return (
    <LinearGradient colors={["#040306", "#131624"]} style={{ flex: 1 }}>
      <SafeAreaView>
        {/* npx expo install expo-linear-gradient */}
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
                    token ? styles.statusConnected : styles.statusDisconnected,
                  ]}
                />
                <Text style={styles.spotifyStatusText}>
                  {token ? "Connected to Spotify" : "Not connected to Spotify"}
                </Text>
              </View>

              {token ? (
                <TouchableOpacity
                  style={styles.spotifyDisconnectButton}
                  onPress={handleLogout}
                >
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.spotifyConnectButton}
                  onPress={handleConnectSpotify}
                  disabled={isAuthenticating}
                >
                  <Image
                    source={require("../assets/white-spotify-logo.png")}
                    style={styles.spotifyIcon}
                  />
                  <Text style={styles.spotifyConnectText}>
                    {isAuthenticating ? "Connecting..." : "Connect to Spotify"}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
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

          <TouchableOpacity style={styles.card}>
            <View
              style={styles.iconContainer}
              onPress={() => alert("sorry this feature isn't available yet!")}
            >
              <Ionicons
                name="play-back-circle-outline"
                size={32}
                color="white"
              />
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#8E44AD", // Purple background for header
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  menuButton: {
    padding: 8,
  },
  logoText: {
    color: "#FFC857", // Golden yellow color
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  placeholder: {
    width: 44, // Same width as menu button for balanced layout
  },
  spotifyStatus: {
    margin: 20,
    padding: 15,
    backgroundColor: "#282828",
    borderRadius: 10,
    alignItems: "center",
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusConnected: {
    backgroundColor: "#1DB954", // Spotify green
  },
  statusDisconnected: {
    backgroundColor: "#e74c3c", // Red
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
  },
  spotifyDisconnectButton: {
    backgroundColor: "#333",
    padding: 10,
    borderRadius: 25,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#666",
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
    shadowColor: "#C6B6DD", // light purple (#c084fc is Tailwind's purple-400)
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
});
