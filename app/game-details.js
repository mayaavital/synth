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
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, child, get } from "firebase/database";


// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCJfNmkM43CH16qnRffvm78lJGK_3wPH9Y",
  authDomain: "synth-database.firebaseapp.com",
  databaseURL: "https://synth-database-default-rtdb.firebaseio.com",
  projectId: "synth-database",
  storageBucket: "synth-database.firebasestorage.app",
  messagingSenderId: "681571197393",
  appId: "1:681571197393:web:21ebf6102f5239372740f0",
  measurementId: "G-ND9VF6MRB4",
};

var app = initializeApp(firebaseConfig);
var db = getDatabase();


var {
  GameDataBranches,
  UserDataBranches,
  DATABASE_BRANCHES,
} = require("../server/database-branches");



if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

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
        const response = await fetch(`https://synth-69a11b47cbf3.herokuapp.com/prev_game?gameId=${gameId}`);
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

  // Debug log for game data
  console.log("DEBUG gameData.game_data:", gameData.game_data);

  let playedSongs = [];
  let roundsCount = 0;
  const numPlayers = gameData.metadata.players.length;

  // Prefer roundSongs if available
  if (
    gameData.game_data?.roundSongs &&
    typeof gameData.game_data.roundSongs === 'object' &&
    Object.keys(gameData.game_data.roundSongs).length > 0
  ) {
    const roundSongEntries = Object.entries(gameData.game_data.roundSongs)
      .filter(([_, data]) => data && data.song) // filter out null/invalid
      .sort((a, b) => Number(a[0]) - Number(b[0]));
    playedSongs = roundSongEntries.map(([round, data]) => ({
      ...(data.song || {}),
      roundNumber: Number(round),
      playerId: data.owner?.id || (data.song?.assignedToPlayer?.id ?? null),
      playerName: data.owner?.username || (data.song?.assignedToPlayer?.username ?? "Unknown"),
    }));
    roundsCount = roundSongEntries.length;
  } else if (gameData.game_data?.maxRounds) {
    // Fallback to maxRounds and guess_tracks
    const guessTracks = gameData.game_data.guess_tracks || [];
    for (let round = 0; round < gameData.game_data.maxRounds; round++) {
      const guessIndex = round * numPlayers;
      if (guessTracks[guessIndex] && guessTracks[guessIndex].track) {
        playedSongs.push({
          ...guessTracks[guessIndex].track,
          roundNumber: round + 1,
          playerId: guessTracks[guessIndex].owner.id,
          playerName: guessTracks[guessIndex].owner.username,
        });
      }
    }
    roundsCount = gameData.game_data.maxRounds;
  } else {
    // Fallback to old logic
    const guessTracks = gameData.game_data?.guess_tracks || [];
    const roundMap = new Map();
    guessTracks.forEach((guess, index) => {
      if (guess.track) {
        const roundNumber = Math.floor(index / numPlayers) + 1;
        if (!roundMap.has(roundNumber)) {
          roundMap.set(roundNumber, {
            ...guess.track,
            roundNumber,
            playerId: guess.owner.id,
            playerName: guess.owner.username
          });
        }
      }
    });
    const sortedRounds = Array.from(roundMap.values()).sort((a, b) => a.roundNumber - b.roundNumber);
    playedSongs = sortedRounds;
    roundsCount = roundMap.size;
  }

  // Helper to get externalUrl for a song from combined_tracks or guess_tracks
  function getExternalUrlForSong(song, roundNumber) {
    const guessTracks = gameData.game_data.guess_tracks || [];
    const combinedTracks = gameData.game_data.combined_tracks || {};
    // Try to find in guess_tracks
    const guessTrack = guessTracks.find(gt =>
      (gt.track?.songTitle === song.songTitle || gt.track?.songTitle === song.title) &&
      gt.track?.externalUrl
    );
    if (guessTrack && guessTrack.track && guessTrack.track.externalUrl) {
      return guessTrack.track.externalUrl;
    }
    // Try to find in combined_tracks (search all arrays for a matching songTitle)
    for (const playerTracks of Object.values(combinedTracks)) {
      const match = playerTracks.find(track =>
        track.songTitle === song.songTitle || track.songTitle === song.title
      );
      if (match && match.externalUrl) {
        return match.externalUrl;
      }
    }
    // Fallback to song.externalUrl
    return song.externalUrl;
  }

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
            Rounds played: {roundsCount}
          </Text>
        </View>

        <View style={styles.scoresContainer}>
          <Text style={styles.scoresTitle}>Final Scores</Text>
          <View style={styles.scoresList}>
            {(() => {
              const realUsernames = gameData.metadata.players.map(p => p.username);
              return (Object.entries(gameData.game_data.scoresWithUsernames || gameData.game_data.scores || {}))
                .filter(([username]) => realUsernames.includes(username))
                .map(([username, score], idx) => {
                  const player = gameData.metadata.players.find(p => p.username === username);
                  return (
                    <View key={username} style={[styles.scoreItem, idx === 0 && styles.topScorer]}>
                      <View style={styles.scorePlayerInfo}>
                        <Image
                          source={{ uri: player?.profilePicture || "https://via.placeholder.com/40" }}
                          style={styles.scorePlayerAvatar}
                        />
                        <Text style={styles.scorePlayerName}>
                          {username}
                        </Text>
                      </View>
                      <Text style={styles.scoreValue}>{score} points</Text>
                    </View>
                  );
                });
            })()}
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
                <TouchableOpacity
                  style={styles.spotifyButton}
                  onPress={() => {

                    const dbRef = ref(getDatabase());

                    get(child(dbRef, `${DATABASE_BRANCHES.ANALYTICS}/${"previous_add_song"}`)).then((snapshot) => {
                    if (snapshot.exists()) {
                      console.log(snapshot.val());
                    } else {
                      console.log("No data available");
                    }
                  }).catch((error) => {
                    console.error(error);
                  });
                  /*

                    var prevGameRef = db.ref().child(DATABASE_BRANCHES.ANALYTICS).child("previous_add_song")

                    prevGameRef.once("value", async (snapshot) => {
                      if (snapshot.exists()) {
                        const gameData = snapshot.val();

                        console.log("Previous game data:", gameData);

                        prevGameRef.set({
                          data: gameData.data + 1
                        })
                      } else {
                        console.log("No previous game data found.");
                      }

                    }
                    );
                    if (getExternalUrlForSong(song, song.roundNumber)) {
                      Linking.openURL(getExternalUrlForSong(song, song.roundNumber));
                    }
                      */
                  }}
                >
                  <Ionicons name="add" size={20} color="white" />
                </TouchableOpacity>
                <View style={styles.reviewPlayerAvatarWrapper}>
                  {/* <Image
                    source={{ 
                      uri: gameData.metadata.players.find(p => p.id === song.playerId)?.profilePicture 
                        || "https://via.placeholder.com/40" 
                    }}
                    style={styles.reviewPlayerAvatar}
                  /> */}
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
    paddingVertical: 5,
    paddingHorizontal: 16,
    height: 80,
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
    paddingBottom: 10
  },
  headerTitle: {
    color: "white",
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
  spotifyButton: {
    backgroundColor: "#1DB954", // Spotify green
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 0,
  },
}); 