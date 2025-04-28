import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSpotifyAuth } from "../utils";
import { getMyRecentlyPlayedTracks } from "../utils/apiOptions";

const ROUNDS_TOTAL = 3;

export default function GamePlay() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useSpotifyAuth();
  
  // State variables
  const [isLoading, setIsLoading] = useState(true);
  const [allSongs, setAllSongs] = useState([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentSong, setCurrentSong] = useState(null);
  const [gameStage, setGameStage] = useState('loading'); // loading, playing, voting, results
  const [error, setError] = useState(null);
  const [playerSongs, setPlayerSongs] = useState({});
  
  // Get game details from params
  const gameName = params.gameName || "Game Name";
  const playerCount = parseInt(params.playerCount) || 4;
  
  // Mock player data (for demo)
  const players = [
    { id: 1, username: "@luke_mcfall", platform: "spotify" },
    { id: 2, username: "@cole_sprout", platform: "spotify" },
    { id: 3, username: "@maya_avital", platform: "spotify" },
    { id: 4, username: "@john_doe", platform: "spotify" },
  ].slice(0, playerCount);

  // Set header options
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Fetch songs when component mounts
  useEffect(() => {
    const fetchSongs = async () => {
      try {
        setIsLoading(true);
        
        if (!token) {
          setError("No Spotify token available");
          setIsLoading(false);
          return;
        }
        
        // Fetch songs from Spotify API
        const recentTracks = await getMyRecentlyPlayedTracks(token);
        
        if (!recentTracks || recentTracks.length === 0) {
          setError("No tracks found");
          setIsLoading(false);
          return;
        }
        
        console.log(`Fetched ${recentTracks.length} tracks`);
        
        // Take up to 15 songs and associate them with random players
        const processedSongs = recentTracks.slice(0, 15).map(track => ({
          ...track,
          assignedToPlayer: players[Math.floor(Math.random() * players.length)],
        }));
        
        setAllSongs(processedSongs);
        
        // Select first song for first round
        selectSongForRound(1, processedSongs);
        
        setIsLoading(false);
        setGameStage('playing');
      } catch (err) {
        console.error("Error fetching songs:", err);
        setError("Failed to fetch songs: " + err.message);
        setIsLoading(false);
      }
    };
    
    fetchSongs();
  }, [token]);
  
  // Select a song for the current round
  const selectSongForRound = (round, songs = allSongs) => {
    if (!songs || songs.length === 0) return;
    
    // Select a song based on round number (for demo purposes)
    // In a real game, you'd want to ensure no duplicates between rounds
    const index = (round - 1) % songs.length;
    setCurrentSong(songs[index]);
  };
  
  // Move to the next round
  const nextRound = () => {
    if (currentRound < ROUNDS_TOTAL) {
      const nextRoundNum = currentRound + 1;
      setCurrentRound(nextRoundNum);
      selectSongForRound(nextRoundNum);
      setGameStage('playing');
    } else {
      // Game over - would show final results
      setGameStage('results');
    }
  };

  const handleReturnToLobby = () => {
    router.replace('/game-lobby');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
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
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C143FF" />
          <Text style={styles.loadingText}>Loading songs...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
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
        
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable 
            style={styles.retryButton}
            onPress={handleReturnToLobby}
          >
            <Text style={styles.retryButtonText}>Back to Lobby</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
      
      <View style={styles.gameStatusBar}>
        <Text style={styles.roundText}>Round {currentRound} of {ROUNDS_TOTAL}</Text>
      </View>
      
      {currentSong && (
        <View style={styles.songContainer}>
          <Image 
            source={{ uri: currentSong.imageUrl }} 
            style={styles.albumCover}
            resizeMode="cover"
          />
          
          <View style={styles.songInfoContainer}>
            <Text style={styles.songTitle}>{currentSong.songTitle}</Text>
            <Text style={styles.artistName}>{currentSong.songArtists.join(', ')}</Text>
          </View>
          
          <Text style={styles.assignedPlayerText}>
            Assigned to: {currentSong.assignedToPlayer.username}
          </Text>
          
          {gameStage === 'playing' && (
            <Pressable
              style={styles.actionButton}
              onPress={() => setGameStage('voting')}
            >
              <Text style={styles.actionButtonText}>Ready to Vote</Text>
            </Pressable>
          )}
          
          {gameStage === 'voting' && (
            <View style={styles.votingContainer}>
              <Text style={styles.votingInstructions}>
                Who do you think listened to this song?
              </Text>
              
              <View style={styles.playersGrid}>
                {players.map(player => (
                  <Pressable
                    key={player.id}
                    style={styles.playerVoteButton}
                    onPress={() => {
                      // In a real game, would record the vote
                      // For demo, just move to next round
                      nextRound();
                    }}
                  >
                    <View style={styles.profileImageContainer}>
                      <View style={styles.profileBackground}>
                        <Image 
                          source={require('../assets/pfp.png')} 
                          style={styles.profileImage} 
                        />
                      </View>
                    </View>
                    <Text style={styles.playerVoteName}>{player.username}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          
          {gameStage === 'results' && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>Game Complete!</Text>
              <Pressable
                style={styles.actionButton}
                onPress={handleReturnToLobby}
              >
                <Text style={styles.actionButtonText}>Back to Lobby</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#8E44AD',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  gameStatusBar: {
    backgroundColor: '#2A2A2A',
    padding: 12,
    alignItems: 'center',
  },
  roundText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  songContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  albumCover: {
    width: '80%',
    aspectRatio: 1,
    borderRadius: 12,
    marginTop: 20,
  },
  songInfoContainer: {
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  songTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  artistName: {
    color: '#BBBBBB',
    fontSize: 18,
    marginTop: 8,
    textAlign: 'center',
  },
  assignedPlayerText: {
    color: '#C143FF',
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
  actionButton: {
    backgroundColor: '#C143FF',
    marginTop: 30,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  votingContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  votingInstructions: {
    color: 'white',
    fontSize: 18,
    marginBottom: 16,
  },
  playersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
  playerVoteButton: {
    alignItems: 'center',
    marginBottom: 20,
    width: '45%',
  },
  profileImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileBackground: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  playerVoteName: {
    color: 'white',
    fontSize: 14,
    marginTop: 8,
  },
  resultsContainer: {
    alignItems: 'center',
    marginTop: 30,
  },
  resultsTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
}); 