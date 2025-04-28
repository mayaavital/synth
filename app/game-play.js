import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSpotifyAuth } from "../utils";
import { getMyRecentlyPlayedTracks } from "../utils/apiOptions";
import { Audio } from "expo-av";
import Slider from '@react-native-community/slider';

const ROUNDS_TOTAL = 3;
const MIN_PLAY_DURATION = 30000; // 30 seconds in milliseconds

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
  const [hasFetchedSongs, setHasFetchedSongs] = useState(false);
  
  // Audio playback states
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [songDuration, setSongDuration] = useState(0);
  const [canVote, setCanVote] = useState(false);
  const positionUpdateInterval = useRef(null);
  
  // Get game details from params
  const gameName = params.gameName || "Game Name";
  const playerCount = parseInt(params.playerCount) || 4;
  const gameId = params.gameId || `game-${Date.now()}`;
  
  // Parse player usernames from params if available
  let playerUsernames = [];
  try {
    if (params.players) {
      playerUsernames = JSON.parse(params.players);
    }
  } catch (e) {
    console.error("Error parsing player data:", e);
  }
  
  // Create players array using player usernames if available
  const players = playerUsernames.length > 0 
    ? playerUsernames.map((username, index) => ({
        id: index + 1,
        username,
        platform: "spotify"
      })) 
    : [
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
    
    console.log("Game started with params:", {
      gameName,
      playerCount,
      gameId,
      players: players.map(p => p.username)
    });
  }, [navigation]);

  // Fetch songs when component mounts - but only once
  useEffect(() => {
    // Skip if we've already fetched songs or if token is undefined
    if (hasFetchedSongs || token === undefined) {
      return;
    }
    
    const fetchSongs = async () => {
      try {
        setIsLoading(true);
        
        // Mock song data to use if token is not available
        const mockSongs = [
          {
            songTitle: "A Day in the Life",
            songArtists: ["The Beatles"],
            albumName: "Sgt. Pepper's Lonely Hearts Club Band",
            imageUrl: "https://i.scdn.co/image/ab67616d0000b273128450651c9f0442780d8eb8",
            duration: 337000,
            previewUrl: "https://p.scdn.co/mp3-preview/67f504bf5b86bdcaf197aef343c2413e8ec68b1d",
          },
          {
            songTitle: "Bohemian Rhapsody",
            songArtists: ["Queen"],
            albumName: "A Night at the Opera",
            imageUrl: "https://i.scdn.co/image/ab67616d0000b27328581cfe196c2be2506ee6c0",
            duration: 354000,
            previewUrl: "https://p.scdn.co/mp3-preview/1f8e6abaed1a4f4399a0677a1771fccc3b6858b9",
          },
          {
            songTitle: "Hotel California",
            songArtists: ["Eagles"],
            albumName: "Hotel California",
            imageUrl: "https://i.scdn.co/image/ab67616d0000b273446e630d93d3fb235d70bad9",
            duration: 391000,
            previewUrl: "https://p.scdn.co/mp3-preview/77cc7b5141629531e37db44e7f9950f12705b987",
          },
          {
            songTitle: "Billie Jean",
            songArtists: ["Michael Jackson"],
            albumName: "Thriller",
            imageUrl: "https://i.scdn.co/image/ab67616d0000b273982d4494b5ce78e84f1a5de4",
            duration: 294000,
            previewUrl: "https://p.scdn.co/mp3-preview/14602bfa5a1745966e4c4becbe637f2bb164d8b5",
          },
          {
            songTitle: "Purple Haze",
            songArtists: ["Jimi Hendrix"],
            albumName: "Are You Experienced",
            imageUrl: "https://i.scdn.co/image/ab67616d0000b273a9feeafe29cb1e4318b075b8",
            duration: 171000,
            previewUrl: "https://p.scdn.co/mp3-preview/8407186fb4e9e393d85e93fdd26d0559e56ef817",
          },
        ];
        
        let tracks;
        
        console.log("Current token status:", token ? "Token available" : "No token");
        
        if (!token) {
          console.log("No Spotify token available, using mock song data");
          tracks = mockSongs;
        } else {
          try {
            // Fetch songs from Spotify API - only try once to avoid rate limits
            console.log("Fetching tracks using token");
            tracks = await getMyRecentlyPlayedTracks(token);
            console.log("Successfully fetched tracks from Spotify API:", tracks?.length || 0);
            
            if (!tracks || tracks.length === 0) {
              console.log("No tracks found from Spotify API, using mock song data");
              tracks = mockSongs;
            }
          } catch (apiError) {
            console.error("Error fetching from Spotify API:", apiError);
            // If we hit rate limit, use mock data and don't retry
            if (apiError?.response?.status === 429) {
              console.log("Rate limit reached (429), using mock data without retrying");
            }
            tracks = mockSongs;
          }
        }
        
        console.log(`Using ${tracks.length} tracks for the game`);
        
        // Take up to 15 songs and associate them with random players
        const processedSongs = tracks.slice(0, 15).map(track => ({
          ...track,
          assignedToPlayer: players[Math.floor(Math.random() * players.length)],
        }));
        
        setAllSongs(processedSongs);
        
        // Select first song for first round
        selectSongForRound(1, processedSongs);
        
        setIsLoading(false);
        setGameStage('playing');
        setHasFetchedSongs(true); // Mark as having fetched songs to prevent loops
      } catch (err) {
        console.error("Error fetching songs:", err);
        setError("Failed to fetch songs: " + err.message);
        setIsLoading(false);
        setHasFetchedSongs(true); // Mark as having fetched even on error to prevent infinite retries
      }
    };
    
    // Only fetch songs once
    fetchSongs();
  }, [token, players, hasFetchedSongs]);

  // Cleanup audio resources when unmounting
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      if (positionUpdateInterval.current) {
        clearInterval(positionUpdateInterval.current);
      }
    };
  }, [sound]);
  
  // Select a song for the current round
  const selectSongForRound = (round, songs = allSongs) => {
    if (!songs || songs.length === 0) return;
    
    // Select a song based on round number (for demo purposes)
    // In a real game, you'd want to ensure no duplicates between rounds
    const index = (round - 1) % songs.length;
    setCurrentSong(songs[index]);
    
    // Reset playback states
    setPlaybackPosition(0);
    setSongDuration(0);
    setCanVote(false);
    
    // Start playing the new song
    loadAndPlaySong(songs[index]);
  };
  
  // Load and play the selected song
  const loadAndPlaySong = async (song) => {
    try {
      // Unload any existing sound
      if (sound) {
        await sound.unloadAsync();
        if (positionUpdateInterval.current) {
          clearInterval(positionUpdateInterval.current);
        }
      }
      
      // Only proceed if there's a preview URL
      if (!song.previewUrl) {
        console.warn("No preview URL available for this song");
        // For demo purposes, allow voting even without audio
        setTimeout(() => {
          setCanVote(true);
        }, 5000); // Let them vote after just 5 seconds if no audio
        return;
      }
      
      try {
        // Load the new sound
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: song.previewUrl },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        
        setSound(newSound);
        setIsPlaying(true);
        
        // Start timer to enable voting after 30 seconds
        setTimeout(() => {
          setCanVote(true);
        }, MIN_PLAY_DURATION);
        
        // Set up interval to update playback position
        positionUpdateInterval.current = setInterval(async () => {
          if (sound) {
            const status = await sound.getStatusAsync();
            if (status.isLoaded) {
              setPlaybackPosition(status.positionMillis);
            }
          }
        }, 1000);
      } catch (audioError) {
        // If audio fails to load, still allow the game to continue
        console.error("Error loading audio:", audioError);
        // Enable voting after a shorter time if audio fails
        setTimeout(() => {
          setCanVote(true);
        }, 5000);
      }
      
    } catch (error) {
      console.error("Error in loadAndPlaySong:", error);
      // Enable voting as a fallback
      setCanVote(true);
    }
  };
  
  // Handle playback status updates
  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setSongDuration(status.durationMillis || 0);
      setPlaybackPosition(status.positionMillis);
      
      // If the song ended naturally
      if (status.didJustFinish) {
        setCanVote(true);
        
        if (positionUpdateInterval.current) {
          clearInterval(positionUpdateInterval.current);
        }
      }
    }
  };
  
  // Toggle play/pause
  const togglePlayPause = async () => {
    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  // Move to the next round
  const nextRound = () => {
    // Stop current playback
    if (sound) {
      sound.stopAsync();
      if (positionUpdateInterval.current) {
        clearInterval(positionUpdateInterval.current);
      }
    }
    
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
      
      {currentSong && gameStage === 'playing' && (
        <View style={styles.songPlaybackContainer}>
          {/* Album artwork with stylish background */}
          <View style={styles.albumArtworkWrapper}>
            <View style={styles.albumArtworkBackground}>
              <Image 
                source={{ uri: currentSong.imageUrl }} 
                style={styles.albumCover}
                resizeMode="cover"
              />
            </View>
          </View>
          
          {/* Song info */}
          <View style={styles.songPlaybackInfo}>
            <Text style={styles.playbackSongTitle}>{currentSong.songTitle}</Text>
            <Text style={styles.playbackArtistName}>{currentSong.songArtists.join(', ')}</Text>
          </View>
          
          {/* Custom waveform visualization */}
          <View style={styles.waveformContainer}>
            <View style={styles.waveformBars}>
              {Array.from({ length: 30 }).map((_, index) => {
                // Create random heights for the bars to simulate a waveform
                const randomHeight = 10 + Math.random() * 40;
                return (
                  <View 
                    key={index}
                    style={[
                      styles.waveformBar,
                      { 
                        height: randomHeight,
                        opacity: index % 3 === 0 ? 0.9 : index % 2 === 0 ? 0.7 : 0.5
                      }
                    ]}
                  />
                );
              })}
            </View>
          </View>
          
          {/* Playback controls */}
          <View style={styles.playbackControlsContainer}>
            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={togglePlayPause}
            >
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={28} 
                color="white" 
              />
            </TouchableOpacity>
            
            {/* Progress bar */}
            <View style={styles.progressBarContainer}>
              <Slider
                style={styles.progressBar}
                minimumValue={0}
                maximumValue={songDuration > 0 ? songDuration : 1}
                value={playbackPosition}
                minimumTrackTintColor="#C143FF"
                maximumTrackTintColor="#4D4D4D"
                thumbTintColor="#FFFFFF"
                disabled={true}
              />
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>
                  {formatTime(playbackPosition)}
                </Text>
                <Text style={styles.timeText}>
                  {formatTime(songDuration)}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Bottom vote button */}
          <View style={styles.voteButtonContainer}>
            <Pressable
              style={[
                styles.voteButton, 
                !canVote && styles.voteButtonDisabled
              ]}
              onPress={() => {
                if (canVote) {
                  setGameStage('voting');
                }
              }}
              disabled={!canVote}
            >
              <Text style={styles.voteButtonText}>VOTE</Text>
              <Ionicons name="arrow-forward" size={24} color="black" />
            </Pressable>
            {!canVote && (
              <Text style={styles.voteHintText}>
                Listen for at least 30 seconds to enable voting
              </Text>
            )}
          </View>
        </View>
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
                  // Store the vote (in a real app, you'd send this to a backend)
                  const newVote = {
                    round: currentRound,
                    songId: currentSong?.songTitle,
                    votedFor: player.username,
                    correctPlayer: currentSong?.assignedToPlayer?.username
                  };
                  
                  console.log("Vote cast:", newVote);
                  
                  // Check if this was the correct guess
                  const isCorrectGuess = 
                    player.username === currentSong?.assignedToPlayer?.username;
                  
                  // Show feedback (in a full implementation, you'd show this to all players)
                  Alert.alert(
                    isCorrectGuess ? "Correct!" : "Incorrect!",
                    isCorrectGuess 
                      ? `Yes, ${player.username} listened to this song!` 
                      : `Actually, ${currentSong?.assignedToPlayer?.username} listened to this song.`,
                    [{ 
                      text: "Next Round", 
                      onPress: () => nextRound()
                    }]
                  );
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
          
          <View style={styles.gameStats}>
            <Text style={styles.gameStatsHeader}>
              {gameName} - Game #{gameId.split('-')[1].substring(0, 6)}
            </Text>
            
            <Text style={styles.gameStatLine}>
              Players: {players.map(p => p.username).join(', ')}
            </Text>
            
            <Text style={styles.gameStatLine}>
              Songs played: {currentRound}
            </Text>
            
            <Text style={styles.gameStatLine}>
              Game type: Guess The Listener
            </Text>
          </View>
          
          <Pressable
            style={styles.returnButton}
            onPress={handleReturnToLobby}
          >
            <Text style={styles.returnButtonText}>Return to Lobby</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

// Helper function to format time in MM:SS
const formatTime = (milliseconds) => {
  if (!milliseconds) return "00:00";
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

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
  gameStatusBar: {
    backgroundColor: "#282828",
    padding: 12,
    alignItems: "center",
  },
  roundText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "white",
    marginTop: 20,
    fontSize: 18,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "white",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 30,
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: "#C143FF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  songPlaybackContainer: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  albumArtworkWrapper: {
    alignItems: "center",
    marginTop: 20,
  },
  albumArtworkBackground: {
    width: 300,
    height: 300,
    borderRadius: 20,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#333", // Dark background color
    // Apply outer glow effect
    shadowColor: "#8E44AD", // Purple glow color
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  albumCover: {
    width: "100%",
    height: "100%",
    borderRadius: 15,
  },
  songPlaybackInfo: {
    alignItems: "center",
    marginTop: 20,
  },
  playbackSongTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  playbackArtistName: {
    color: "#CCC",
    fontSize: 18,
    marginTop: 8,
    textAlign: "center",
  },
  waveformContainer: {
    height: 80,
    marginTop: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  waveformBars: {
    width: "100%",
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  waveformBar: {
    width: 8,
    backgroundColor: "#8E44AD",
    borderRadius: 4,
  },
  playbackControlsContainer: {
    marginTop: 20,
  },
  playPauseButton: {
    alignSelf: "center",
    backgroundColor: "#8E44AD",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  progressBarContainer: {
    marginHorizontal: 10,
  },
  progressBar: {
    width: "100%",
    height: 40,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -10,
  },
  timeText: {
    color: "#AAA",
    fontSize: 14,
  },
  voteButtonContainer: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: "center",
  },
  voteButton: {
    backgroundColor: "#FFC857", // Gold color for the button
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "80%",
    borderWidth: 2,
    borderColor: "#000",
  },
  voteButtonDisabled: {
    backgroundColor: "#7D7575", // Dimmed color for disabled state
    borderColor: "#555",
  },
  voteButtonText: {
    color: "#000",
    fontSize: 22,
    fontWeight: "bold",
    marginRight: 8,
  },
  voteHintText: {
    color: "#AAA",
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
  votingContainer: {
    flex: 1,
    padding: 20,
  },
  votingInstructions: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
  },
  playersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 20,
  },
  playerVoteButton: {
    backgroundColor: "#282828",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    width: "48%",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#444",
  },
  profileImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  profileBackground: {
    width: 70,
    height: 70,
    borderRadius: 35,
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
  playerVoteName: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  resultsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  resultsTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
  },
  gameStats: {
    marginBottom: 30,
  },
  gameStatsHeader: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  gameStatLine: {
    color: "white",
    fontSize: 16,
  },
  returnButton: {
    backgroundColor: "#C143FF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  returnButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
}); 