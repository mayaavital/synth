import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function GameDetails() {
  const router = useRouter();
  const navigation = useNavigation();
  const { gameId } = useLocalSearchParams();
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set header options
  useEffect(() => {
    navigation.setOptions({
        header: (props) => (
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={28} color="white" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Game Details</Text>
                </View>
                <View style={[styles.placeholder, { width: 44 }]} />
            </View>
        ),
    });
}, [navigation]);

  useEffect(() => {
    const fetchGameDetails = async () => {
      try {
        const response = await fetch(`http://10.27.147.68:3000/prev_game?gameId=${gameId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch game data");
        }
        const data = await response.json();
        console.log("Fetched game data:", JSON.stringify(data, null, 2));
        setGameData(data.game);
      } catch (error) {
        console.error("Error fetching game details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGameDetails();
  }, [gameId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFC857" />
          <Text style={styles.loadingText}>Loading game details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!gameData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Game not found</Text>
        </View>
      </SafeAreaView>
    );
  }


  // Get the songs that were actually played during the game
  const playedSongs = [];
  const guessTracks = gameData.game_data?.guess_tracks || [];
  
  // Take only the first N songs where N is the number of rounds played
  const numRounds = Math.min(guessTracks.length, 3); // Assuming 3 rounds max
  const roundSongs = guessTracks.slice(0, numRounds);
  
  roundSongs.forEach((guess, index) => {
    if (guess.track) {
      playedSongs.push({
        ...guess.track,
        roundNumber: index + 1,
        playerId: guess.owner.id,
        playerName: guess.owner.username
      });
    }
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Game Details</Text>
        </View>
        <View style={[styles.placeholder, { width: 44 }]} />
      </View> */}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.gameStats}>
          <Text style={styles.gameStatsHeader}>Game Details</Text>
          <Text style={styles.gameStatLine}>
            Players: {gameData.metadata.players.map(p => p.username).join(", ")}
          </Text>
          <Text style={styles.gameStatLine}>
            Rounds played: {playedSongs.length}
          </Text>
        </View>

        <View style={styles.scoresContainer}>
          <Text style={styles.scoresTitle}>Final Scores</Text>
          <View style={styles.scoresList}>
            {Object.entries(gameData.game_data?.scores || {}).map(([playerId, score], idx) => {
              const player = gameData.metadata.players.find(p => p.id === playerId);
              return (
                <View
                  key={playerId}
                  style={[styles.scoreItem, idx === 0 && styles.topScorer]}
                >
                  <View style={styles.scorePlayerInfo}>
                    <Image
                      source={{ uri: player?.profilePicture || "https://via.placeholder.com/40" }}
                      style={styles.scorePlayerAvatar}
                    />
                    <Text style={styles.scorePlayerName}>
                      {player?.username || "Unknown Player"}
                    </Text>
                  </View>
                  <Text style={styles.scoreValue}>{score} points</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.reviewListContainer}>
          <Text style={styles.reviewListTitle}>Songs Played</Text>
          {playedSongs.map((song) => (
            <View key={`round-${song.roundNumber}`} style={styles.reviewListItem}>
              <View style={styles.roundNumber}>
                <Text style={styles.roundNumberText}>Round {song.roundNumber}</Text>
              </View>
              <Image
                source={{ uri: song.imageUrl || "https://via.placeholder.com/60" }}
                style={styles.reviewSongImage}
              />
              <View style={styles.reviewSongInfo}>
                <Text style={styles.reviewSongTitle}>
                  {song.songTitle || song.title || "Unknown Song"}
                </Text>
                <Text style={styles.reviewSongArtist}>
                  {Array.isArray(song.songArtists) 
                    ? song.songArtists.join(", ")
                    : Array.isArray(song.artists)
                      ? song.artists.join(", ")
                      : song.artists || song.songArtists || "Unknown Artist"}
                </Text>
              </View>
              <View style={styles.reviewPlayerInfo}>
                <View style={styles.reviewPlayerAvatarWrapper}>
                  <Image
                    source={{ 
                      uri: gameData.metadata.players.find(p => p.id === song.playerId)?.profilePicture 
                        || "https://via.placeholder.com/40" 
                    }}
                    style={styles.reviewPlayerAvatar}
                  />
                </View>
                <Text style={styles.reviewPlayerName}>
                  {song.playerName}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
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
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: "#8E44AD",
    paddingVertical: 10,
    paddingHorizontal: 16,
    height: 100,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 7,
    elevation: 5,
  },
  menuButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  headerTitleContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 15
  },
  headerTitle: {
    color: "#FFC857",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  placeholder: {
    width: 44,
  },
  scrollContent: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#CCC",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#CCC",
  },
  gameStats: {
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#444",
  },
  gameStatsHeader: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    color: "#FFC857",
  },
  gameStatLine: {
    fontSize: 14,
    color: "#CCC",
    marginBottom: 5,
  },
  scoresContainer: {
    marginBottom: 20,
  },
  scoresTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    color: "#FFC857",
  },
  scoresList: {
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "#444",
  },
  scoreItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  topScorer: {
    backgroundColor: "#8E44AD",
    borderRadius: 8,
    padding: 10,
  },
  scorePlayerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  scorePlayerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  scorePlayerName: {
    fontSize: 16,
    fontWeight: "500",
    color: "white",
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFC857",
  },
  reviewListContainer: {
    marginBottom: 20,
  },
  reviewListTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    color: "#FFC857",
  },
  reviewListItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#444",
  },
  roundNumber: {
    position: "absolute",
    top: -8,
    left: 15,
    backgroundColor: "#8E44AD",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roundNumberText: {
    fontSize: 12,
    color: "white",
    fontWeight: "500",
  },
  reviewSongImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
  },
  reviewSongInfo: {
    flex: 1,
  },
  reviewSongTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "white",
    marginBottom: 4,
  },
  reviewSongArtist: {
    fontSize: 14,
    color: "#CCC",
  },
  reviewPlayerInfo: {
    alignItems: "center",
    marginLeft: 15,
  },
  reviewPlayerAvatarWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 5,
  },
  reviewPlayerAvatar: {
    width: "100%",
    height: "100%",
  },
  reviewPlayerName: {
    fontSize: 12,
    color: "#CCC",
    textAlign: "center",
  },
}); 