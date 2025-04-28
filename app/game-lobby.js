import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Pressable,
  Alert,
} from "react-native";
import { useNavigation, useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSpotifyAuth } from "../utils";

export default function GameLobby() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useSpotifyAuth();

  // Get game details from params
  const gameName = params.gameName || "Game Name";
  const playerCount = parseInt(params.playerCount) || 4;

  // Placeholder player data (would come from your backend)
  const [players, setPlayers] = useState([
    {
      id: 1,
      username: "@luke_mcfall",
      platform: "spotify",
      isHost: true,
      isConnected: true,
    },
    {
      id: 2,
      username: "@cole_sprout",
      platform: "spotify",
      isHost: false,
      isConnected: true,
    },
    {
      id: 3,
      username: "@maya_avital",
      platform: "spotify",
      isHost: false,
      isConnected: true,
    },
    // Empty slots will be filled based on playerCount
  ]);

  // Track if everyone is ready to start
  const [isEveryoneReady, setIsEveryoneReady] = useState(true);

  // Set header options
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Fill remaining slots as "waiting to join"
  useEffect(() => {
    const filledPlayers = [...players];
    // Make sure we have the correct number of player slots
    while (filledPlayers.length < playerCount) {
      filledPlayers.push({
        id: filledPlayers.length + 1,
        username: null,
        platform: null,
        isHost: false,
        isConnected: false,
      });
    }
    // In case we have more players than the count (shouldn't happen)
    if (filledPlayers.length > playerCount) {
      filledPlayers.length = playerCount;
    }
    setPlayers(filledPlayers);
  }, [playerCount]);

  // Determine card border color based on player index
  const getCardBorderColor = (index) => {
    const colors = ["#FF6B6B", "#00A8E8", "#A44200", "#747474"]; // Red, Blue, Orange, Gray
    return colors[index % colors.length];
  };

  // Handle starting the game
  const handleStartGame = () => {
    // For MVP demo, we'll bypass the token check
    // Check if all expected players are connected
    const connectedPlayers = players.filter((p) => p.isConnected);
    if (connectedPlayers.length < 2) {
      Alert.alert(
        "Not Enough Players",
        "You need at least 2 players to start the game.",
        [{ text: "OK" }]
      );
      return;
    }

    // In a real app, you would probably make an API call here to initialize the game
    // and then listen for a confirmation before navigating

    // Navigate to the game play screen with parameters
    router.push({
      pathname: "/game-play",
      params: {
        gameName,
        playerCount: connectedPlayers.length,
        gameId: `game-${Date.now()}`, // Generate a unique game ID
        // You could also serialize the players array if needed
        players: JSON.stringify(connectedPlayers.map((p) => p.username)),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.logoText}>SYNTH</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Player grid */}
      <View style={styles.playerGrid}>
        {players.map((player, index) => (
          <View
            key={player.id}
            style={[
              styles.playerCard,
              {
                borderColor: getCardBorderColor(index),
                shadowColor: getCardBorderColor(index),
                shadowRadius: 8
              },
            ]}
          >
            {/* {player.isHost && ( // will include this once backend is connected
              <View style={styles.crownContainer}>
                <Ionicons name="crown" size={32} color="white" />
              </View>
            )} */}

            {player.isConnected ? (
              <>
                <View style={styles.profileImageContainer}>
                  <View style={styles.profileBackground}>
                    <Image
                      source={require("../assets/pfp.png")}
                      style={styles.profileImage}
                    />
                  </View>
                </View>
                <Text style={styles.username}>{player.username}</Text>
                <View style={styles.platformContainer}>
                  <Text style={styles.listeningText}>Listening on</Text>
                  <View style={styles.spotifyIcon}>
                    <Image
                      source={require("../assets/white-spotify-logo.png")}
                      style={styles.spotifyLogoImage}
                    />
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.waitingContainer}>
                <Ionicons
                  name="person-circle-outline"
                  size={80}
                  color="white"
                />
                <Text style={styles.waitingText}>Waiting to join...</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Start Game Button */}
      <View style={styles.startButtonContainer}>
        <Pressable
          style={[
            styles.startButton,
            !isEveryoneReady && styles.startButtonDisabled,
          ]}
          onPress={handleStartGame}
        >
          <Text style={styles.startButtonText}>START GAME</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  startButtonContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#8E44AD",
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  menuButton: {
    padding: 8,
  },
  logoText: {
    color: "#FFC857",
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  placeholder: {
    width: 44,
  },
  playerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 16,
    marginTop: 20,
    // flex: 1
  },
  playerCard: {
    width: "47%",
    aspectRatio: 1,
    backgroundColor: "#242424",
    borderRadius: 16,
    marginBottom: 16,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    position: "relative",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  crownContainer: {
    position: "absolute",
    top: -20,
    alignSelf: "center",
  },
  profileImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  profileBackground: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  username: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  platformContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  listeningText: {
    color: "#4CAF50",
    marginRight: 5,
  },
  spotifyIcon: {
    backgroundColor: "#1DB954",
    borderRadius: 12,
    padding: 4,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  spotifyLogoImage: {
    width: 20,
    height: 20,
    resizeMode: "contain",
  },
  waitingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  waitingText: {
    color: "white",
    marginTop: 10,
    fontSize: 16,
  },
  startButton: {
    backgroundColor: "#8E44AD",
    marginHorizontal: 24,
    marginBottom: 30,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: "center",
  },
  startButtonDisabled: {
    backgroundColor: "#674C70",
    opacity: 0.7,
  },
  startButtonText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
});
