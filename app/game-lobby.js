import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { useNavigation, useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";

export default function GameLobby() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();
  
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
              { borderColor: getCardBorderColor(index) }
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
                      source={require('../assets/pfp.png')} 
                      style={styles.profileImage} 
                    />
                  </View>
                </View>
                <Text style={styles.username}>{player.username}</Text>
                <View style={styles.platformContainer}>
                  <Text style={styles.listeningText}>Listening on</Text>
                  <View style={styles.spotifyIcon}>
                    <Image 
                      source={require('../assets/white-spotify-logo.png')} 
                      style={styles.spotifyLogoImage}
                    />
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.waitingContainer}>
                <Ionicons name="person-circle-outline" size={80} color="white" />
                <Text style={styles.waitingText}>Waiting to join...</Text>
              </View>
            )}
          </View>
        ))}
      </View>
      
      {/* Start Game Button */}
      <Pressable
        style={styles.startButton}
        onPress={() => {
          // Would connect to your backend to start the game
          alert("Game starting! This would connect to your backend.");
        }}
      >
        <Text style={styles.startButtonText}>START GAME</Text>
      </Pressable>
    </SafeAreaView>
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
  },
  playerCard: {
    width: '47%',
    aspectRatio: 1,
    backgroundColor: "#242424",
    borderRadius: 16,
    marginBottom: 16,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    position: "relative",
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileBackground: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: "100%",
    height: "100%",
    resizeMode: 'cover',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotifyLogoImage: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
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
    backgroundColor: "#C143FF",
    marginHorizontal: 24,
    marginBottom: 30,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: "center",
  },
  startButtonText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
}); 