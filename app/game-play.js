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
  Linking,
  ScrollView,
} from "react-native";
import { useNavigation, useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import Slider from "@react-native-community/slider";
import { useSpotifyAuth } from "../utils";
import {
  getMyRecentlyPlayedTracks,
  getAlbumTracks,
  getTrackDetails,
} from "../utils/apiOptions";
// Import Deezer API functions
import {
  enrichTracksWithDeezerPreviews,
  findDeezerTrackFromSpotify,
  findDeezerTrackByTitleOnly
} from "../utils/deezerApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import socketService from "../utils/socketService";
import axios from "axios";

const ROUNDS_TOTAL = 5; // Number of rounds to play in the game
const MIN_PLAY_DURATION = 15000; // Set to 15 seconds as specified

// Add a global audio ref outside of the component
const audioRef = {
  isInitialized: false,
  sound: null,
  isLoading: false,
  currentSongId: null
};

// Detect dev mode to add extra logging
const DEV_MODE = true;

// Format time helper function - move outside component to prevent re-creation
const formatTime = (milliseconds) => {
  if (!milliseconds) return "0:00";
  
  let totalSeconds = Math.floor(milliseconds / 1000);
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = totalSeconds % 60;
  
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

// Add a helper to control logging
const debugLog = (...args) => {
  if (DEV_MODE) {
    console.log(...args);
  }
};

export default function GamePlay() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const {
    token,
    getSpotifyAuth,
    logout,
    isTokenValid,
    getValidToken,
    isInitialized,
  } = useSpotifyAuth();

  // Get game details from params
  const gameCode = params.gameCode || "";
  const gameName = params.gameName || "Game Name";
  const playerCount = parseInt(params.playerCount) || 4;
  // Set multiplayer to true since we've implemented socket functionality
  const isMultiplayer = true;
  const isHost = params.isHost === "true";

  // State variables
  const [isLoading, setIsLoading] = useState(true);  // Start with true to show loading screen initially
  const [gameTracks, setGameTracks] = useState([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [currentSong, setCurrentSong] = useState(null);
  const [gameStage, setGameStage] = useState("loading"); // loading, playing, voting, results, finished
  const [error, setError] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [hasFetchedSongs, setHasFetchedSongs] = useState(false);

  // Players state
  const [players, setPlayers] = useState([]);
  const [playerPoints, setPlayerPoints] = useState({});
  const [playerSongs, setPlayerSongs] = useState({});
  const [playedSongs, setPlayedSongs] = useState([]);
  const [roundSongs, setRoundSongs] = useState({});

  // Audio playback state variables
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioLoadError, setAudioLoadError] = useState(null);
  const audioLoadTimeoutRef = useRef(null);

  // Voting state variables
  const [canVote, setCanVote] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showVoteResult, setShowVoteResult] = useState(false);
  const [votesSubmitted, setVotesSubmitted] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);
  const [roundResults, setRoundResults] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  
  // Add ref to track Deezer search status
  const isDeezerSearching = useRef(false);

  // Add ref to prevent re-renders from triggering audio playback
  const hasInitializedRef = useRef(false);
  const skipAudioPlaybackRef = useRef(false);
  const ignoreEffectsRef = useRef(false);

  // Initialize socket listeners
  useEffect(() => {
    console.log("GamePlay component initialized with params:", { gameCode, gameName, playerCount, isHost });
    const socket = socketService.getSocket();
    
    if (!socket) {
      console.error('Socket not initialized in GamePlay');
      setError('Connection error. Please try again.');
      setIsLoading(false);
      return;
    }

    console.log('GamePlay: Setting up socket listeners');
    
    // Parse track and player data if available from params - only on initial mount
    try {
      if (params?.tracks && gameTracks.length === 0) {
        const parsedTracks = typeof params.tracks === 'string' 
          ? JSON.parse(params.tracks) 
          : params.tracks;
          
        if (Array.isArray(parsedTracks) && parsedTracks.length > 0) {
          console.log(`GamePlay: Found ${parsedTracks.length} tracks in params`);
          setGameTracks(parsedTracks);
        }
      }
      
      if (params?.players && players.length === 0) {
        const parsedPlayers = typeof params.players === 'string'
          ? JSON.parse(params.players)
          : params.players;
          
        if (Array.isArray(parsedPlayers)) {
          console.log(`GamePlay: Found ${parsedPlayers.length} players in params`);
          setPlayers(parsedPlayers);
        }
      }
    } catch (e) {
      console.error('GamePlay: Error parsing params:', e);
    }
    
    // Listen for game started event - improved to prevent duplicate starts
    socket.on('game-started', (data) => {
      console.log('[GamePlay] Received game-started event', { 
        hasTracks: data.tracks?.length > 0, 
        playerCount: data.players?.length 
      });
      
      // Skip if we're the host or already playing
      if (isHost || gameStage === 'playing' || currentSong) {
        console.log('[GamePlay] Host or already playing, ignoring game-started event');
        return;
      }
      
      // Set the game as started to prevent multiple starts
      setGameStarted(true);
      
      // Update players if we received them
      if (data.players && Array.isArray(data.players)) {
        console.log(`[GamePlay] Updating player list with ${data.players.length} players`);
        setPlayers(data.players);
      }
      
      // Set tracks and start the game
      if (data.tracks && data.tracks.length > 0) {
        console.log(`[GamePlay] Client received ${data.tracks.length} tracks`);
        
        // Update all game tracks
        setGameTracks(data.tracks);
        
        // Start with the first track
        setCurrentSong(data.tracks[0]);
        
        // Update the game stage to match the server
        setGameStage('playing');
        setIsLoading(false);
      } else {
        console.error('[GamePlay] No tracks received in game-started event');
        setError('No tracks received from host. Please try again.');
      }
    });

    // Listen for vote updates
    socket.on("vote-update", ({ votesSubmitted: votes, totalVotes: total }) => {
      setVotesSubmitted(votes);
      setTotalVotes(total);
    });

    // Listen for round results
    socket.on("round-results", ({ roundNumber, voteResults, correctAnswer }) => {
      setRoundResults({
        roundNumber,
        voteResults,
        correctAnswer
      });
      setShowVoteResult(true);
      setGameStage("results");
    });

    // Listen for next round notification
    socket.on("next-round", ({ roundNumber }) => {
      setCurrentRound(roundNumber);
      if (gameTracks.length > roundNumber) {
        setCurrentSong(gameTracks[roundNumber]);
      }
      setGameStage("playing");
      setShowVoteResult(false);
      setSelectedPlayer(null);
      setHasVoted(false);
      setVotesSubmitted(0);
    });

    // Listen for game over
    socket.on("game-over", ({ finalScores, tracks }) => {
      setPlayerPoints(finalScores);
      setGameStage("finished");
    });

    // Clean up listeners on unmount
    const unsubscribe = () => {
      socket.off("game-started");
      socket.off("vote-update");
      socket.off("round-results");
      socket.off("next-round");
      socket.off("game-over");
    };
    
    return unsubscribe;
  }, []); // Empty dependency array - run only once on mount

  // Auto-start the game when tracks are available from params
  useEffect(() => {
    // This condition should only run ONCE when we first get tracks
    if (isLoading && params.tracks && gameTracks.length > 0 && !currentSong && !gameStarted) {
      console.log('[GamePlay] Auto-starting game with tracks from params');
      
      // Set gameStarted flag to prevent duplicate starts
      setGameStarted(true);
      
      // Emit game started event if we're the host
      if (isHost) {
        console.log('[GamePlay] Host directly starting game with tracks');
        
        // Immediately set the first track to provide better UX
        const firstTrack = gameTracks[0];
        setCurrentSong(firstTrack);
        
        // Use the new callback functionality
        socketService.startGameWithTracks(gameCode, gameTracks, {
          onSuccess: (data) => {
            console.log('[GamePlay] Host start game acknowledged by server');
            // Ensure UI immediately updates to playing state
            setGameStage('playing');
            setIsLoading(false);
          },
          onError: (error) => {
            console.error('[GamePlay] Error starting game:', error.message);
            setError(`Error starting game: ${error.message}`);
          }
        });
      } else {
        // For client devices: set a failsafe timer to exit loading state
        const failsafeTimer = setTimeout(() => {
          if (isLoading && gameStarted) {
            console.log('[GamePlay] Client failsafe: Stuck in loading, forcing state update');
            setIsLoading(false);
            if (currentSong) {
              setGameStage('playing');
            }
          }
        }, 5000); // 5 second failsafe
        
        return () => clearTimeout(failsafeTimer);
      }
    }
  }, [isLoading, params.tracks, gameTracks, currentSong, isHost, gameCode, gameStarted]);

  // Effect to handle current song changes - simplified to avoid race conditions
  useEffect(() => {
    // Only run this if we have a current song
    if (currentSong) {
      console.log("Current song set:", currentSong.name || currentSong.songTitle);
      
      // If we're still in loading state but have a song, transition to playing
      if (isLoading || gameStage === "loading") {
        console.log("Song loaded while still in loading state, transitioning to playing");
        setIsLoading(false);
        setGameStage("playing");
      }
      
      // Only play audio on host device
      if (isHost && gameStage === "playing") {
        console.log("Loading song effect triggered:", currentSong.name || currentSong.songTitle);
        loadAndPlaySong(currentSong);
        
        // Set a simple timer for when to enable voting - no reliance on audio position
        const timer = setTimeout(() => {
          console.log("Timer elapsed, enabling voting");
          setCanVote(true);
          setGameStage("voting");
          
          // Pause the song after voting starts
          if (sound) {
            sound.pauseAsync().catch(e => console.error("Error pausing sound:", e));
            setIsPlaying(false);
          }
        }, MIN_PLAY_DURATION);
        
        return () => clearTimeout(timer);
      } else if (!isHost && gameStage === "playing") {
        // On non-host devices, just show the song info but don't play audio
        console.log("Client showing song info without playing audio");
        // After MIN_PLAY_DURATION, allow voting on client too
        const timer = setTimeout(() => {
          console.log("Client timer elapsed, enabling voting");
          setCanVote(true);
          setGameStage("voting");
        }, MIN_PLAY_DURATION);
        
        return () => clearTimeout(timer);
      }
    }
  }, [currentSong, gameStage, isHost, sound, isLoading]);

  // Replace loadAndPlaySong with a singleton pattern
  const loadAndPlaySong = useCallback(async (song) => {
    // Skip if no song or if this exact song is already loaded
    if (!song) {
      debugLog("No song provided to loadAndPlaySong");
      return;
    }
    
    // Use song id or title as unique identifier
    const songId = song.id || song.songTitle || song.name;
    
    // Skip if same song already loading or loaded
    if (audioRef.isLoading || audioRef.currentSongId === songId) {
      debugLog(`Song ${songId} already loading or loaded, skipping`);
      return;
    }
    
    // Only host plays audio
    if (!isHost) {
      debugLog("Client device not playing audio, updating UI only");
      setCurrentSong(song);
      setIsLoading(false);
      setGameStage('playing');
      return;
    }
    
    debugLog(`Host loading song: ${songId}`);
    
    // Set loading flag to prevent multiple loads
    audioRef.isLoading = true;
    audioRef.currentSongId = songId;
    
    // Always update UI immediately
    setCurrentSong(song);
    setIsLoadingAudio(true);
    setAudioLoadError(null);
    setIsLoading(false);
    setGameStage("playing");
    
    // Clean up any existing audio first
    if (audioRef.sound) {
      try {
        debugLog("Stopping previous sound");
        await audioRef.sound.stopAsync().catch(() => {});
        await audioRef.sound.unloadAsync().catch(() => {});
        audioRef.sound = null;
        setSound(null);
      } catch (error) {
        debugLog("Error stopping previous sound:", error);
      }
    }
    
    // Add a buffer to ensure audio engine has time to reset
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      // Find the preview URL if needed
      if (!song.previewUrl) {
        debugLog("No preview URL, searching Deezer");
        try {
          const deezerTrack = await findDeezerTrackFromSpotify(song);
          if (deezerTrack && deezerTrack.previewUrl) {
            debugLog("Found Deezer preview URL");
            song = {
              ...song,
              previewUrl: deezerTrack.previewUrl
            };
          } else {
            // Last resort - try searching just by title
            const lastResortTrack = await findDeezerTrackByTitleOnly(song.songTitle || song.name);
            if (lastResortTrack && lastResortTrack.previewUrl) {
              debugLog("Found preview URL via last resort search");
              song = {
                ...song,
                previewUrl: lastResortTrack.previewUrl
              };
            }
          }
        } catch (deezerError) {
          debugLog("Error finding Deezer preview:", deezerError);
        }
      }

      // Check if we have a preview URL after all attempts
      if (!song.previewUrl) {
        debugLog("No preview URL available for song");
        setAudioLoadError("No audio preview available");
        setIsLoadingAudio(false);
        audioRef.isLoading = false;
        return;
      }

      // Skip if unmounted or we need to skip audio
      if (skipAudioPlaybackRef.current) {
        debugLog("Skipping audio playback as requested");
        audioRef.isLoading = false;
        return;
      }

      // Try to load the audio
      debugLog("Loading audio from URL:", song.previewUrl);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: song.previewUrl },
        { shouldPlay: false }
      );

      // Skip if unmounted or we need to skip audio
      if (skipAudioPlaybackRef.current) {
        debugLog("Component unmounted after audio load, unloading");
        await newSound.unloadAsync().catch(() => {});
        audioRef.isLoading = false;
        return;
      }

      // Store in global ref and in state
      audioRef.sound = newSound;
      setSound(newSound);
      
      debugLog("Successfully loaded audio");
      
      // Set up status update handler
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (skipAudioPlaybackRef.current) return;
        
        if (status.isLoaded) {
          setPlaybackPosition(status.positionMillis);
          setPlaybackDuration(status.durationMillis);
          setIsPlaying(status.isPlaying);
        }
      });
      
      // Play audio after a small delay
      await new Promise(resolve => {
        setTimeout(async () => {
          try {
            if (!skipAudioPlaybackRef.current && audioRef.sound) {
              debugLog("Starting playback");
              await audioRef.sound.playAsync();
              setIsPlaying(true);
            }
            resolve();
          } catch (playError) {
            debugLog("Error starting playback:", playError);
            resolve();
          }
        }, 300);
      });
    } catch (error) {
      debugLog("Error loading audio:", error);
      setAudioLoadError(`Couldn't load audio: ${error.message}`);
    } finally {
      setIsLoadingAudio(false);
      audioRef.isLoading = false;
    }
  }, [isHost]);

  // Completely replace the audio initialization effect
  useEffect(() => {
    debugLog("Setting up audio module");
    
    const setupAudio = async () => {
      try {
        // Reset the audio engine first
        await Audio.setIsEnabledAsync(false);
        await new Promise(resolve => setTimeout(resolve, 100));
        await Audio.setIsEnabledAsync(true);
        
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: Audio.InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: Audio.InterruptionModeAndroid.DoNotMix,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
        
        debugLog("Audio system initialized");
        audioRef.isInitialized = true;
      } catch (error) {
        debugLog("Error setting up audio mode:", error);
      }
    };
    
    setupAudio();
    
    return () => {
      debugLog("GamePlay unmounting - cleaning up audio");
      
      // Mark to skip any in-progress audio operations
      skipAudioPlaybackRef.current = true;
      
      // Clean up in a separate async function
      (async () => {
        if (audioRef.sound) {
          try {
            await audioRef.sound.stopAsync().catch(() => {});
            await audioRef.sound.unloadAsync().catch(() => {});
            audioRef.sound = null;
          } catch(e) {
            debugLog("Error cleaning up audio:", e);
          }
        }
        
        try {
          await Audio.setIsEnabledAsync(false);
        } catch(e) {
          debugLog("Error disabling audio:", e);
        }
      })();
    };
  }, []);

  // Fix the first-time start effect
  useEffect(() => {
    if (hasInitializedRef.current || ignoreEffectsRef.current) {
      return;  // Only run on first render
    }
    
    // Mark as initialized
    hasInitializedRef.current = true;
    
    // Auto-play the first track if this is the host and we have tracks
    if (isHost && gameTracks.length > 0 && !currentSong) {
      debugLog("Auto-starting with first track");
      loadAndPlaySong(gameTracks[0]);
    }
  }, [isHost, gameTracks.length, currentSong, loadAndPlaySong]);
  
  // Add a specialized effect to detect when loading finishes
  useEffect(() => {
    // If we have a song but we're still loading, exit loading
    if (currentSong && isLoading) {
      debugLog("Song available, exiting loading state");
      setIsLoading(false);
      setGameStage('playing');
    }
  }, [currentSong, isLoading]);
  
  // Add a fail-safe for loading screen
  useEffect(() => {
    if (!isLoading) return;
    
    const timer = setTimeout(() => {
      if (isLoading) {
        debugLog("Force exiting loading state after timeout");
        setIsLoading(false);
        
        if (gameTracks.length > 0) {
          setGameStage('playing');
          
          // Only set current song if not already set
          if (!currentSong) {
            debugLog("Setting first track as current song");
            setCurrentSong(gameTracks[0]);
          }
        }
      }
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [isLoading, currentSong, gameTracks]);
  
  // Fix the renderGameContent to avoid causing re-renders
  const renderGameContent = useCallback(() => {
    // Skip loading screen completely if we have a song
    if (currentSong && (isLoading || gameStage === 'loading')) {
      debugLog("DIRECT RENDER: Bypassing loading state, rendering playing UI");
      return renderGamePlaying();
    }
    
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8E44AD" />
          <Text style={styles.loadingText}>Loading game...</Text>
          {gameStarted && <Text style={styles.debugText}>Game started, waiting for tracks...</Text>}
        </View>
      );
    }
    
    // Rest of rendering logic...
    
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleReturnToLobby}>
            <Text style={styles.retryButtonText}>Return to Lobby</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    switch (gameStage) {
      case "playing":
      case "voting":
        return renderGamePlaying();
      case "results":
        return renderGameResults();
      case "gameOver":
        return renderGameOver();
      default:
        // If we have a song but no specific state, show playing UI
        if (currentSong) {
          debugLog("Default case with song, showing playing UI");
          return renderGamePlaying();
        }
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8E44AD" />
            <Text style={styles.loadingText}>Preparing game...</Text>
            <Text style={styles.debugText}>Game stage: {gameStage}</Text>
          </View>
        );
    }
  }, [
    currentSong, 
    isLoading, 
    error, 
    gameStage, 
    gameStarted,
    handleReturnToLobby,
    renderGamePlaying,
    renderGameResults,
    renderGameOver
  ]);

  // Set header options
  useEffect(() => {
    navigation.setOptions({
      header: (props) => (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={handleReturnToLobby}
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{gameName}</Text>
          </View>

          <View style={[styles.placeholder, { width: 44 }]} />
        </View>
      ),
      title: gameName,
    });
  }, [navigation, gameName]);

  // Memoize the handleSeek function to avoid re-creation on each render
  const handleSeek = useCallback(async (position) => {
    if (!sound) return;
    
    try {
      await sound.setPositionAsync(position);
    } catch (error) {
      console.error("Error seeking sound:", error);
    }
  }, [sound]);

  // Handle player selection for voting
  const handlePlayerSelect = (player) => {
    if (gameStage !== "voting" || hasVoted) return;
    
    setSelectedPlayer(player);
  };

  // Submit a vote
  const handleVoteSubmit = () => {
    if (!selectedPlayer || hasVoted || gameStage !== "voting") return;
    
    // Send vote to the server
    socketService.submitVote(selectedPlayer.id);
    setHasVoted(true);
    
    // Update local votes count for UI feedback
    setVotesSubmitted(prevVotes => prevVotes + 1);
  };

  // Memoize selectSongForRound to prevent recreation on each render
  const selectSongForRound = useCallback((roundNum) => {
    // Check if we have enough tracks
    if (!gameTracks || roundNum >= gameTracks.length) {
      console.error(`Not enough tracks for round ${roundNum}`);
      setError("Not enough tracks to continue the game");
      return;
    }
    
    // Stop any existing audio first
    (async () => {
      if (sound) {
        try {
          console.log("Stopping existing audio before loading new song");
          await sound.stopAsync();
          await sound.unloadAsync();
          setSound(null);
        } catch (error) {
          console.error("Error stopping sound in selectSongForRound:", error);
        }
      }
      
      // Use a small timeout to ensure audio is fully stopped
      setTimeout(() => {
        const selectedTrack = gameTracks[roundNum];
        console.log(`Selected song for round ${roundNum}:`, selectedTrack.name || selectedTrack.songTitle);
        setCurrentSong(selectedTrack);
      }, 100);
    })();
  }, [gameTracks, sound]);

  // Memoize handleReturnToLobby
  const handleReturnToLobby = useCallback(() => {
    // Clean up any existing audio
    if (sound) {
      sound.unloadAsync().catch(e => console.log("Error unloading sound", e));
    }
    
    // Navigate back to the lobby
    router.replace({
      pathname: "/game-lobby",
      params: {
        gameName,
        playerCount,
        players: JSON.stringify(players.map(p => p.username)),
        returningFromGame: "true",
      }
    });
  }, [sound, router, gameName, playerCount, players]);

  // Memoize the getProfilePhotoForUser function
  const getProfilePhotoForUser = useCallback((player) => {
    // Default or placeholder image
    const defaultImage = require("../assets/pfp.png");
    
    // If player has a profile image URL, use it
    if (player.profileImage) {
      return { uri: player.profileImage };
    }
    
    // Otherwise return default image
    return defaultImage;
  }, []);
  
  // Memoize the getPlayerNameDisplay function
  const getPlayerNameDisplay = useCallback((player) => {
    if (!player) return "";
    return player.username;
  }, []);
  
  // Memoize the isPlayerTrackOwner function
  const isPlayerTrackOwner = useCallback((playerId) => {
    if (!currentSong) return false;
    return currentSong.ownerId === playerId;
  }, [currentSong]);

  // Memoize the handlePlayAgain function
  const handlePlayAgain = useCallback(() => {
    // Reset the game state
    setCurrentRound(1);
    setGameStage("loading");
    setPlayerSongs({});
    setRoundSongs({});
    
    // Stop any playing audio
    if (sound) {
      sound.stopAsync().catch(e => console.log("Error stopping sound", e));
      sound.unloadAsync().catch(e => console.log("Error unloading sound", e));
      setSound(null);
    }
    
    // Reset audio playback state
    setIsPlaying(false);
    setPlaybackPosition(0);
    setPlaybackDuration(0);
    setCanVote(false);
    
    // Reset voting state
    setSelectedPlayer(null);
    setShowVoteResult(false);
    
    // Reset points
    setPlayerPoints(players.reduce((acc, player) => {
      acc[player.username] = 0;
      return acc;
    }, {}));
    
    // Restart the game
    setIsLoading(true);
    
    // Add a small delay to ensure state updates have propagated
    setTimeout(() => {
      // Select a song for the first round
      if (gameTracks.length > 0) {
        selectSongForRound(1);
      }
      setIsLoading(false);
      setGameStage("playing");
    }, 500);
  }, [sound, players, gameTracks, selectSongForRound]);

  // Ensure the renderGamePlaying function handles the UI correctly without causing re-renders
  const renderGamePlaying = useCallback(() => {
    console.log("Rendering game playing UI", {
      hasCurrentSong: !!currentSong,
      gameStage,
      audioState: isPlaying ? "playing" : "paused",
      audioLoading: isLoadingAudio
    });
    
    return (
      <View style={styles.gameContainer}>
        {/* Round info */}
        <View style={styles.roundInfo}>
          <Text style={styles.roundText}>
            Round {currentRound || 1} of {ROUNDS_TOTAL}
          </Text>
        </View>

        {/* Song Player Section */}
        <View style={styles.playerSection}>
          {currentSong ? (
            <>
              <View style={styles.albumArtContainer}>
                <Image
                  source={
                    currentSong.albumArt || currentSong.imageUrl
                      ? { uri: currentSong.albumArt || currentSong.imageUrl }
                      : require("../assets/default-album-art.png")
                  }
                  style={styles.albumArt}
                  resizeMode="cover"
                  // Add key to ensure image refreshes when the song changes
                  key={`album-art-${currentSong.id || currentSong.songTitle}`}
                />
              </View>

              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle}>Who's song is this?</Text>
                <Text style={styles.debugText}>
                  {currentSong.name || currentSong.songTitle || "Unknown Song"}
                </Text>
              </View>

              {audioLoadError ? (
                <View style={styles.audioErrorContainer}>
                  <Text style={styles.audioErrorText}>{audioLoadError}</Text>
                </View>
              ) : isLoadingAudio ? (
                <View style={styles.loadingAudioContainer}>
                  <ActivityIndicator color="#8E44AD" />
                  <Text style={styles.loadingAudioText}>
                    Loading audio...
                  </Text>
                </View>
              ) : (
                <View style={styles.playbackContainer}>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={playbackDuration || 1}
                    value={playbackPosition || 0}
                    onSlidingComplete={handleSeek}
                    minimumTrackTintColor="#8E44AD"
                    maximumTrackTintColor="#333"
                    thumbTintColor="#FFC857"
                  />

                  <View style={styles.timeContainer}>
                    <Text style={styles.timeText}>
                      {formatTime(playbackPosition)}
                    </Text>
                    <Text style={styles.timeText}>
                      {formatTime(playbackDuration)}
                    </Text>
                  </View>

                  {isHost && (
                    <TouchableOpacity
                      style={styles.playButton}
                      onPress={togglePlayPause}
                    >
                      <Ionicons
                        name={isPlaying ? "pause" : "play"}
                        size={32}
                        color="white"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          ) : (
            <View style={styles.noSongContainer}>
              <Text style={styles.noSongText}>Waiting for song to load...</Text>
            </View>
          )}
        </View>

        {/* Player voting section - only show if in voting stage */}
        {gameStage === "voting" && (
          <View style={styles.votingSection}>
            <Text style={styles.votingPrompt}>
              Whose song is this? Vote now!
            </Text>
            
            <ScrollView>
              <View style={styles.playersGrid}>
                {players.map((player) => {
                  const isSelected = selectedPlayer === player.username;
                  const isCorrect = showVoteResult && 
                    player.username === currentSong?.assignedToPlayer?.username;
                  
                  const buttonStyle = [
                    styles.playerVoteCard,
                    isSelected && styles.selectedPlayerCard,
                    isCorrect && styles.correctPlayerCard
                  ];
                  
                  return (
                    <Pressable
                      key={player.id}
                      style={buttonStyle}
                      onPress={() => {
                        // Only allow selection if no result is shown yet
                        if (showVoteResult) return;
                        
                        // Set the selected player
                        setSelectedPlayer(player.username);
                        setShowVoteResult(true);
                        
                        // Create the vote record
                        const isCorrectGuess = player.username === currentSong?.assignedToPlayer?.username;
                        const newVote = {
                          round: currentRound,
                          songId: currentSong?.songTitle,
                          votedFor: player.username,
                          correctPlayer: currentSong?.assignedToPlayer?.username,
                          isCorrect: isCorrectGuess
                        };

                        // Update player scores tracking
                        setPlayerSongs(prev => ({
                          ...prev,
                          [player.username]: [...(prev[player.username] || []), newVote]
                        }));

                        console.log("Vote cast:", newVote);
                      }}
                    >
                      <View style={styles.playerAvatarContainer}>
                        <Image
                          source={getProfilePhotoForUser(player)}
                          style={styles.playerAvatar}
                        />
                      </View>
                      <Text style={styles.playerUsername}>{player.username}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Next round button (only visible after voting) */}
        {showVoteResult && (
          <View style={styles.nextRoundContainer}>
            <Pressable style={styles.nextRoundButton} onPress={nextRound}>
              <Text style={styles.nextRoundButtonText}>
                {currentRound >= ROUNDS_TOTAL ? "See Final Results" : "Next Round"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }, [
    currentRound, 
    ROUNDS_TOTAL, 
    currentSong, 
    audioLoadError, 
    isLoadingAudio, 
    playbackDuration, 
    playbackPosition, 
    handleSeek, 
    isPlaying, 
    togglePlayPause, 
    players, 
    selectedPlayer, 
    showVoteResult, 
    nextRound,
    getProfilePhotoForUser,
    setPlayerSongs,
    setSelectedPlayer,
    setShowVoteResult,
    gameStage,
    isHost
  ]);

  const renderGameResults = useCallback(() => {
    // Create a sorted list of players by points
    const sortedPlayers = [...players].sort((a, b) => {
      const aPoints = playerPoints[a.username] || 0;
      const bPoints = playerPoints[b.username] || 0;
      return bPoints - aPoints; // Sort descending
    });

    return (
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Game Results</Text>
        
        <ScrollView style={styles.finalResultsScroll}>
          {sortedPlayers.map((player, index) => (
            <View 
              key={player.id} 
              style={[
                styles.playerResultRow,
                index === 0 && styles.winnerRow
              ]}
            >
              <View style={styles.rankContainer}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              
              <View style={styles.playerResultInfo}>
                <Image
                  source={getProfilePhotoForUser(player)}
                  style={[
                    styles.resultAvatar,
                    index === 0 && styles.winnerAvatar
                  ]}
                />
                <Text style={styles.resultUsername}>{player.username}</Text>
              </View>
              
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreText}>{playerPoints[player.username] || 0}</Text>
                <Text style={styles.pointsLabel}>pts</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        
        <View style={styles.gameOverButtonsContainer}>
          <Pressable
            style={styles.playAgainButton}
            onPress={handlePlayAgain}
          >
            <Text style={styles.playAgainButtonText}>Play Again</Text>
          </Pressable>
          
          <Pressable
            style={styles.returnToHomeButton}
            onPress={handleReturnToLobby}
          >
            <Text style={styles.returnToHomeButtonText}>Return to Lobby</Text>
          </Pressable>
        </View>
      </View>
    );
  }, [players, playerPoints, getProfilePhotoForUser, handlePlayAgain, handleReturnToLobby]);

  const renderGameOver = useCallback(() => {
    return renderGameResults(); // Just reuse the results renderer for game over
  }, [renderGameResults]);

  // Memoize the togglePlayPause function
  const togglePlayPause = useCallback(async () => {
    if (!sound) return;
    
    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error("Error toggling playback:", error);
    }
  }, [sound, isPlaying]);

  // Fix the useEffect dependency for nextRound - restore the proper function format
  const nextRound = useCallback(async () => {
    // Reset voting visual state
    setSelectedPlayer(null);
    setShowVoteResult(false);
    
    // Stop current playback
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      } catch (error) {
        console.error("Error stopping sound:", error);
      }
    }

    // Reset playback-related states
    setPlaybackPosition(0);
    setPlaybackDuration(0);
    setCanVote(false); 
    setIsPlaying(false);
    setAudioLoadError(null);

    if (currentRound < ROUNDS_TOTAL) {
      const nextRoundNum = currentRound + 1;
      setCurrentRound(nextRoundNum);
      setGameStage("playing");

      // Add a small delay to make sure UI updates before loading the next song
      setTimeout(() => {
        selectSongForRound(nextRoundNum);
      }, 100);
    } else {
      // Game over - would show final results
      setGameStage("results");
    }
  }, [currentRound, sound, selectSongForRound, ROUNDS_TOTAL]);

  return (
    <SafeAreaView style={styles.container}>
      {renderGameContent()}
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    height: 100,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 7,
    elevation: 5,
  },
  headerTitleContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFC857",
    fontSize: 24,
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "white",
    fontSize: 18,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    color: "#FF6B6B",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 16,
  },
  errorMessage: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: "#8E44AD",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
  },
  errorButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  gameContainer: {
    flex: 1,
    padding: 16,
  },
  roundInfo: {
    alignItems: "center",
    marginVertical: 8,
  },
  roundText: {
    color: "#FFC857",
    fontSize: 20,
    fontWeight: "bold",
  },
  playerSection: {
    backgroundColor: "#242424",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  albumArtContainer: {
    width: 200,
    height: 200,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  albumArt: {
    width: "100%",
    height: "100%",
  },
  trackInfo: {
    alignItems: "center",
    marginBottom: 16,
  },
  trackTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  trackArtist: {
    color: "#BBB",
    fontSize: 16,
    textAlign: "center",
    marginTop: 4,
  },
  audioErrorContainer: {
    backgroundColor: "rgba(255, 107, 107, 0.2)",
    padding: 10,
    borderRadius: 8,
    marginVertical: 16,
    width: "100%",
    alignItems: "center",
  },
  audioErrorText: {
    color: "#FF6B6B",
    textAlign: "center",
  },
  loadingAudioContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
  },
  loadingAudioText: {
    color: "white",
    marginLeft: 10,
  },
  playbackContainer: {
    width: "100%",
    alignItems: "center",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  timeContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  timeText: {
    color: "#BBB",
    fontSize: 12,
  },
  playButton: {
    backgroundColor: "#8E44AD",
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  votingSection: {
    flex: 1,
  },
  votingPrompt: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  playersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  playerVoteCard: {
    backgroundColor: "#242424",
    width: "48%",
    aspectRatio: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedPlayerCard: {
    borderColor: "#8E44AD",
    backgroundColor: "#341547",
  },
  playerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  playerUsername: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  voteButtonContainer: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  voteButton: {
    backgroundColor: "#8E44AD",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 50,
    minWidth: 200,
    alignItems: "center",
  },
  voteButtonDisabled: {
    backgroundColor: "#3E2844",
    opacity: 0.7,
  },
  voteButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  waitingForVotesContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  waitingForVotesText: {
    color: "#BBB",
    fontSize: 14,
  },
  resultsSection: {
    backgroundColor: "#242424",
    borderRadius: 16,
    padding: 16,
    flex: 1,
  },
  resultsTitle: {
    color: "#FFC857",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  correctAnswerContainer: {
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  correctAnswerLabel: {
    color: "#FFC857",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  ownerContainer: {
    alignItems: "center",
  },
  ownerInfoContainer: {
    alignItems: "center",
  },
  ownerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
  },
  ownerUsername: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  votesTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  votesScrollView: {
    flex: 1,
  },
  voteResultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  playerVoteInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  voteResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  voteResultUsername: {
    color: "white",
    fontSize: 16,
  },
  voteCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2A2A2A",
    borderRadius: 16,
    padding: 8,
  },
  voteCount: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 4,
  },
  gameOverContainer: {
    flex: 1,
    padding: 24,
  },
  gameOverTitle: {
    color: "#FFC857",
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  gameOverSubtitle: {
    color: "white",
    fontSize: 24,
    textAlign: "center",
    marginBottom: 24,
  },
  scoresScrollView: {
    flex: 1,
    marginBottom: 24,
  },
  playerScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#242424",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  winnerRow: {
    borderColor: "#FFC857",
    borderWidth: 2,
    backgroundColor: "#312912",
  },
  rankContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#3A3A3A",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rankText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  playerScoreInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  scoreAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  scoreUsername: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  pointsContainer: {
    alignItems: "flex-end",
  },
  pointsText: {
    color: "#FFC857",
    fontSize: 24,
    fontWeight: "bold",
  },
  pointsLabel: {
    color: "#BBB",
    fontSize: 14,
  },
  gameOverButtonsContainer: {
    marginBottom: 24,
  },
  playAgainButton: {
    backgroundColor: "#8E44AD",
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  playAgainButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  returnToHomeButton: {
    backgroundColor: "#333",
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: "center",
  },
  returnToHomeButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  resultsContainer: {
    flex: 1,
    padding: 24,
  },
  finalResultsScroll: {
    flex: 1,
    marginBottom: 24,
  },
  playerResultRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#242424",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  winnerAvatar: {
    borderColor: "#FFC857",
    borderWidth: 2,
    backgroundColor: "#312912",
  },
  playerResultInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  resultAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  resultUsername: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  scoreContainer: {
    alignItems: "flex-end",
  },
  scoreText: {
    color: "#FFC857",
    fontSize: 24,
    fontWeight: "bold",
  },
  nextRoundContainer: {
    alignItems: "center",
    marginTop: 16,
  },
  nextRoundButton: {
    backgroundColor: "#8E44AD",
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: "center",
  },
  nextRoundButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  correctPlayerCard: {
    borderColor: "#00FF00",
    backgroundColor: "#003300",
  },
  playerAvatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  debugText: {
    color: "#AAA",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  noSongContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noSongText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});