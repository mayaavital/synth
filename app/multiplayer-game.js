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
  FlatList,
  TextInput,
  Modal,
} from "react-native";
import { useNavigation, useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWebSocket, EVENTS } from "../utils/useWebSocket";
import QRCode from 'react-native-qrcode-svg';
// Import Spotify utilities
import getEnv from "../utils/env";
import { getMyRecentlyPlayedTracks, getSpotifyUserProfile } from "../utils/apiOptions";
import useSpotifyAuth from "../utils/useSpotifyAuth";

export default function MultiplayerGame() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const lastReconnectAttempt = useRef(0);
  const { 
    connect, 
    isConnected, 
    error: wsError, 
    createGame,
    joinGame,
    playerReady,
    startGame,
    on,
    disconnect
  } = useWebSocket();
  
  // Spotify auth hook for getting tokens
  const { 
    token: spotifyToken,
    getValidToken: getSpotifyToken,
    isTokenValid: isSpotifyTokenValid,
  } = useSpotifyAuth();

  // Game state
  const [connectionStep, setConnectionStep] = useState('initial'); // initial, connecting, host, join, lobby, game
  const [serverUrl, setServerUrl] = useState('https://synth-69a11b47cbf3.herokuapp.com');
  const [username, setUsername] = useState('');
  const [gameName, setGameName] = useState('');
  const [gameId, setGameId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [allPlayersReady, setAllPlayersReady] = useState(false);
  const [gameState, setGameState] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playerTracks, setPlayerTracks] = useState([]);
  const [selectedRounds, setSelectedRounds] = useState(3); // Default to 3 rounds

  // UI state
  const [showServerInput, setShowServerInput] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  // Add state for user profile
  const [userProfile, setUserProfile] = useState(null);

  // Load saved username from storage
  useEffect(() => {
    const loadUsername = async () => {
      try {
        const savedUsername = await AsyncStorage.getItem('multiplayer_username');
        if (savedUsername) {
          setUsername(savedUsername);
        }
      } catch (err) {
        console.error('Error loading username:', err);
      }
    };
    
    loadUsername();
  }, []);

  // Save username to storage
  useEffect(() => {
    if (username) {
      AsyncStorage.setItem('multiplayer_username', username).catch(err => {
        console.error('Error saving username:', err);
      });
    }
  }, [username]);

  // Set header options
  useEffect(() => {
    navigation.setOptions({
      header: (props) => (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Multiplayer</Text>
          </View>
          <View style={[styles.placeholder, { width: 44 }]} />
        </View>
      ),
    });
  }, [navigation, connectionStep]);

  // Add connection status tracking log
  useEffect(() => {
    console.log(`WebSocket connection status changed in multiplayer-game: ${isConnected ? 'Connected' : 'Disconnected'}`);
  }, [isConnected]);

  // Handle WebSocket connection status changes
  useEffect(() => {
    if (wsError) {
      setError(wsError);
      setLoading(false);
      
      // If there's a connection error, move back to server configuration
      if (connectionStep === 'connecting' && wsError.includes('Connection error')) {
        setConnectionStep('initial');
        setShowServerInput(true);
      }
    }
  }, [wsError, connectionStep]);

  // Handle returning from game
  useEffect(() => {
    // Check if we're returning from a game
    if (params.returningFromGame === "true" && params.gameId) {
      console.log("Returning from game with gameId:", params.gameId);
      
      // If we're already connected and in a lobby, stay there
      if (isConnected && connectionStep === 'lobby') {
        console.log("Already in lobby, maintaining state");
        return;
      }
      
      // Set the game ID from params
      setGameId(params.gameId);
      
      // If we have a game name, set it
      if (params.gameName) {
        setGameName(params.gameName);
      }
      
      // If we're already connected but not in the lobby, move to lobby
      if (isConnected && connectionStep !== 'lobby') {
        setConnectionStep('lobby');
        setLoading(false);
        return; // Added return to prevent attempting connection if already connected
      } 
      // Otherwise try to connect only if not loading and not in a connection attempt
      else if (!isConnected && !loading) {
        // Check if we've recently tried to reconnect (within the last 3 seconds)
        const now = Date.now();
        
        if (now - lastReconnectAttempt.current < 3000) {
          console.log("Skipping reconnection attempt - too soon since last attempt");
          return;
        }
        
        // Update the last reconnect attempt timestamp
        lastReconnectAttempt.current = now;
        
        setConnectionStep('connecting');
        setLoading(true);
        
        // Auto-connect to the server
        connect(serverUrl || undefined).then(connectedSocket => {
          if (connectedSocket) {
            console.log("Successfully reconnected to server");
            setConnectionStep('lobby');
          } else {
            console.error("Failed to reconnect to server");
            setError("Failed to reconnect to the game server. Please try again.");
            setConnectionStep('initial');
          }
          setLoading(false);
        });
      }
    }
  }, [params.returningFromGame, params.gameId, params.gameName, isConnected, connectionStep, connect, serverUrl, loading]);

  // Register WebSocket event listeners
  useEffect(() => {
    if (!isConnected) return;

    // Game created event
    const gameCreatedCleanup = on(EVENTS.GAME_CREATED, (data) => {
      console.log('Game created:', data);
      setGameId(data.gameId);
      setGameState(data.game);
      setPlayers(data.game.players);
      setConnectionStep('lobby');
      setLoading(false);

                const debugPrevGames = async () => {
            let prevGames = await AsyncStorage.getItem("playedGameIds");
            console.log("Previous games:" + prevGames);
          }
          debugPrevGames();

                // Append the current gameId to a list of played game IDs in AsyncStorage
          const appendGameIdToHistory = async () => {
            try {
              const key = "playedGameIds";
              const gameID = data.gameId;
              console.log("Appending gameId to history created: " + data.gameId);
              const existing = await AsyncStorage.getItem(key);
              let gameIds = [];
              if (existing) {
                gameIds = JSON.parse(existing);
              }
              if (!gameIds.includes(gameID)) {
                gameIds.push(gameID);
                await AsyncStorage.setItem(key, JSON.stringify(gameIds));
                debugPrevGames();
                console.log(`Appended gameId ${gameID} to playedGameIds`);
              }
            } catch (err) {
              console.log("Appending gameId to history: " + data.game.gameId);
              console.log("Error appending gameId to history:", err);
            }
          };
          appendGameIdToHistory();


    });

    // Player joined event
    const playerJoinedCleanup = on(EVENTS.PLAYER_JOINED, (data) => {
      console.log('Player joined:', data);

          const debugPrevGames = async () => {
            let prevGames = await AsyncStorage.getItem("playedGameIds");
            console.log("Previous games:" + prevGames);
          }

          // Append the current gameId to a list of played game IDs in AsyncStorage
          const appendGameIdToHistory = async () => {
            try {
              const key = "playedGameIds";
              const gameID = data.game.id;
              console.log("Appending gameId to history: " + gameID);
              const existing = await AsyncStorage.getItem(key);
              let gameIds = [];
              if (existing) {
                gameIds = JSON.parse(existing);
              }
              if (!gameIds.includes(gameID)) {
                gameIds.push(gameID);
                await AsyncStorage.setItem(key, JSON.stringify(gameIds));
                console.log(`Appended gameId ${gameID} to playedGameIds`);
                debugPrevGames();
              }
            } catch (err) {
              console.log("Appending gameId to history: " + data.game.gameId);
              console.log("Error appending gameId to history:", err);
            }
          };
          appendGameIdToHistory();



      // Update game state and players list
      setGameState(data.game);
      setPlayers(data.game.players);
      
      // Ensure we transition to lobby when we receive player_joined event
      if (connectionStep === 'connecting' || connectionStep === 'join') {
        setConnectionStep('lobby');
        setLoading(false);
      }
    });

    // Game updated event
    const gameUpdatedCleanup = on(EVENTS.GAME_UPDATED, (data) => {
      console.log('Game updated:', data);
      setGameState(data.game);
      setPlayers(data.game.players);
      setAllPlayersReady(data.allReady);
    });

    // Game started event
    const gameStartedCleanup = on(EVENTS.GAME_STARTED, (data) => {
      console.log('Game started:', data);
      setGameState(data.game);

      
      // Navigate to the game screen
      router.push({
        pathname: "/game-play",
        params: {
          gameName: data.game.name,
          playerCount: data.game.players.length,
          gameId: data.game.id,
          players: JSON.stringify(data.game.players.map(p => p.username)),
          isMultiplayer: "true",
          isHost: isHost ? "true" : "false"
        }
      });
    });

    // Player left event
    const playerLeftCleanup = on(EVENTS.PLAYER_LEFT, (data) => {
      console.log('Player left:', data);
      setGameState(data.game);
      setPlayers(data.game.players);
    });

    // Error event
    const errorCleanup = on(EVENTS.ERROR, (data) => {
      console.log('Error:', data);
      setError(data.message);
      setLoading(false);
    });

    // Cleanup function
    return () => {
      gameCreatedCleanup();
      playerJoinedCleanup();
      gameUpdatedCleanup();
      gameStartedCleanup();
      playerLeftCleanup();
      errorCleanup();
    };
  }, [isConnected, on, router, isHost]);

  // Helper function to handle back navigation
  const handleBack = useCallback(() => {
    if (connectionStep === 'lobby') {
      Alert.alert(
        'Leave Game',
        'Are you sure you want to leave this game?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Leave', 
            style: 'destructive',
            onPress: () => {
              disconnect();
              setConnectionStep('initial');
            }
          },
        ]
      );
    } else if (connectionStep === 'host' || connectionStep === 'join') {
      setConnectionStep('connecting');
    } else if (connectionStep === 'connecting') {
      disconnect();
      setConnectionStep('initial');
    } else {
      router.back();
    }
  }, [connectionStep, disconnect, router]);

  // Connect to server
  const handleConnect = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const connectedSocket = await connect(serverUrl || undefined);
      if (connectedSocket) {
        setConnectionStep('connecting');
      }
    } catch (err) {
      setError(`Failed to connect: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [connect, serverUrl]);

  // Load Spotify profile when token is available
  useEffect(() => {
    const fetchSpotifyProfile = async () => {
      if (!spotifyToken) return;
      
      try {
        const profile = await getSpotifyUserProfile(spotifyToken);
        if (profile) {
          console.log('Fetched Spotify profile:', profile.displayName);
          setUserProfile(profile);
          
          // Optionally set username from Spotify if not set by user
          if (!username && profile.displayName) {
            setUsername(profile.displayName);
          }
        }
      } catch (error) {
        console.error('Error fetching Spotify profile:', error);
      }
    };
    
    fetchSpotifyProfile();
  }, [spotifyToken, username]);

  // Create a new game
  const handleCreateGame = useCallback(async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    
    if (!gameName.trim()) {
      setError('Please enter a game name');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch player's recent tracks
      const playerTracks = await fetchRecentTracks();
      
      // Store player tracks for later use
      setPlayerTracks(playerTracks);
      
      setIsHost(true);
      
      const gameData = {
        gameName,
        hostUsername: username,
        maxRounds: selectedRounds,
        hostTracks: playerTracks,
        tracks: playerTracks,
        // Add profile information
        profileInfo: userProfile ? {
          displayName: userProfile.displayName,
          profilePicture: userProfile.profilePicture,
          spotifyId: userProfile.id
        } : null
      };
      
      console.log(`Creating game with ${playerTracks.length} host tracks and profile info: ${userProfile ? 'Yes' : 'No'}`);
      
      createGame(gameData);
    } catch (err) {
      console.error('Error creating game:', err);
      setError(`Failed to create game: ${err.message}`);
      setLoading(false);
    }
  }, [username, gameName, createGame, fetchRecentTracks, userProfile, selectedRounds]);

  // Join an existing game
  const handleJoinGame = useCallback(async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    
    if (!joinCode.trim()) {
      setError('Please enter a game code');
      return;
    }
    
    setLoading(true);
    setError(null);
    setIsHost(false);
    
    try {
      // Fetch player's recent tracks
      const playerTracks = await fetchRecentTracks();
      
      // Store player tracks for later use
      setPlayerTracks(playerTracks);
      
      // Check connection status before attempting to join
      if (!isConnected) {
        // Not connected, try to connect first
        Alert.alert(
          'Connection Issue',
          'Not connected to the server. Would you like to reconnect?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setLoading(false)
            },
            {
              text: 'Reconnect',
              onPress: async () => {
                try {
                  await connect(serverUrl || undefined);
                  // Wait a moment for the connection to stabilize
                  setTimeout(() => {
                    // Try joining again with tracks and profile
                    const profileInfo = userProfile ? {
                      displayName: userProfile.displayName,
                      profilePicture: userProfile.profilePicture,
                      spotifyId: userProfile.id
                    } : null;
                    
                    const joinSuccess = joinGame(joinCode, username, profileInfo, playerTracks);
                    if (joinSuccess) {
                      setGameId(joinCode);
                    } else {
                      setError('Failed to join game. Please try again.');
                      setLoading(false);
                    }
                  }, 1500);
                } catch (err) {
                  setError(`Connection failed: ${err.message}`);
                  setLoading(false);
                }
              }
            }
          ]
        );
        return;
      }
      
      // We're connected, try to join with tracks
      console.log(`Attempting to join game ${joinCode} as ${username} with ${playerTracks.length} tracks...`);
      
      // Add profile information to join request
      const profileInfo = userProfile ? {
        displayName: userProfile.displayName,
        profilePicture: userProfile.profilePicture,
        spotifyId: userProfile.id
      } : null;
      
      console.log('Including profile info in join request:', profileInfo);
      const joinSuccess = joinGame(joinCode, username, profileInfo, playerTracks);
      
      if (joinSuccess) {
        setGameId(joinCode);
        
        // Set a timeout in case we don't receive player_joined event
        setTimeout(() => {
          if (connectionStep !== 'lobby' && loading) {
            setError('Joining timed out. The game may not exist or the server may be unreachable.');
            setLoading(false);
          }
        }, 10000);
      } else {
        setError('Failed to join game. Please check your connection and try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error joining game:', err);
      setError(`Failed to join game: ${err.message}`);
      setLoading(false);
    }
  }, [username, joinCode, joinGame, isConnected, connect, serverUrl, connectionStep, loading, fetchRecentTracks, userProfile]);

  // Mark player as ready
  const handleReady = useCallback(() => {
    playerReady(gameId);
    setIsReady(true);
  }, [playerReady, gameId]);

  // Start the game (host only)
  const handleStartGame = useCallback(() => {
    if (!isHost) return;
    
    startGame(gameId);
  }, [isHost, startGame, gameId]);

  // Add a new function to refresh game state
  const refreshGameState = useCallback(() => {
    if (!isConnected || !gameId) {
      return;
    }
    
    setLoading(true);
    // Re-join the game to get fresh state
    joinGame(gameId, username);
    
    // Set a timeout to clear loading state in case no response
    setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 5000);
  }, [isConnected, gameId, username, joinGame]);

  // Fetch player's recent tracks for multiplayer
  const fetchRecentTracks = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching recent tracks for multiplayer game...');
      
      // Get valid token using our hook
      let token = null;
      try {
        // First try to use the token from our hook
        if (isSpotifyTokenValid()) {
          token = spotifyToken;
          console.log('Using token from Spotify hook');
        } else {
          // Try to get a fresh token
          token = await getSpotifyToken();
          console.log('Got fresh token from Spotify hook');
        }
      } catch (tokenError) {
        console.error('Error getting Spotify token:', tokenError);
      }
      
      // If we have a token, use it
      let tracksToProcess = [];
      
      if (token) {
        try {
          console.log('Using token to fetch recently played tracks');
          const tracks = await getMyRecentlyPlayedTracks(token);
          
          if (tracks && tracks.length > 0) {
            // Convert to the format expected by the multiplayer game
            tracksToProcess = tracks.slice(0, 5).map(track => ({
              songTitle: track.songTitle,
              songArtists: track.songArtists.map(artist => artist.name || artist),
              albumName: track.albumName,
              imageUrl: track.imageUrl,
              previewUrl: track.previewUrl,
              uri: track.uri,
              trackId: track.id,
              externalUrl: track.externalUrl,
              duration: track.duration
            }));
            
            console.log(`Found ${tracksToProcess.length} valid tracks for multiplayer`);
          }
        } catch (apiError) {
          console.error('Error calling Spotify API:', apiError);
        }
      } else {
        console.log('No valid Spotify token available');
      }
      
      // If we didn't get any tracks from Spotify, use mock tracks
      if (!tracksToProcess.length) {
        console.log('Using mock tracks for multiplayer');
        tracksToProcess = [];
        for (let i = 1; i <= 5; i++) {
          tracksToProcess.push({
            songTitle: `Test Song ${i}`,
            songArtists: ['Test Artist'],
            albumName: 'Test Album',
            imageUrl: 'https://via.placeholder.com/300',
            previewUrl: null, // Set to null to force Deezer enrichment
            uri: `spotify:track:mock${i}`,
            trackId: `mock${i}`,
            duration: 30000
          });
        }
      }
      
      // IMPORTANT: Always enrich tracks with Deezer preview URLs
      console.log('Enriching all tracks with Deezer preview URLs before sending to server');
      
      try {
        // Import the enrichTracksWithDeezerPreviews function
        const { enrichTracksWithDeezerPreviews } = require('../utils/deezerApi');
        
        // Enrich all tracks with Deezer, even if they already have preview URLs
        const enrichedTracks = await enrichTracksWithDeezerPreviews(tracksToProcess);
        
        // Log the enrichment results
        const tracksWithPreviewUrls = enrichedTracks.filter(track => !!track.previewUrl).length;
        console.log(`After Deezer enrichment: ${tracksWithPreviewUrls}/${enrichedTracks.length} tracks have preview URLs`);
        
        return enrichedTracks;
      } catch (deezerError) {
        console.error('Error enriching tracks with Deezer:', deezerError);
        // Continue with original tracks if enrichment fails
        return tracksToProcess;
      }
    } catch (error) {
      console.error('Error fetching recent tracks:', error);
      setError(`Could not fetch your tracks: ${error.message}`);
      
      // Return mock tracks on failure
      return Array(5).fill().map((_, i) => ({
        songTitle: `Backup Song ${i+1}`,
        songArtists: ['Backup Artist'],
        albumName: 'Backup Album',
        imageUrl: 'https://via.placeholder.com/300',
        previewUrl: 'https://p.scdn.co/mp3-preview/your-preview-url',
        uri: `spotify:track:backup${i}`,
        trackId: `backup${i}`,
        duration: 30000
      }));
    } finally {
      setLoading(false);
    }
  }, [isSpotifyTokenValid, spotifyToken, getSpotifyToken]);

  const renderInitialScreen = () => (
    <View style={styles.contentContainer}>
      <Image 
        source={require('../assets/SYNTH.png')} 
        style={styles.logo}
        resizeMode="contain"
      />
      
      <Text style={styles.welcomeText}>
        Welcome to Synth Multiplayer!
      </Text>
      
      <Text style={styles.infoText}>
        Play with friends on the same WiFi network.
      </Text>
      
      <View style={styles.buttonsContainer}>
        <Pressable 
          style={styles.primaryButton}
          onPress={handleConnect}
        >
          <Text style={styles.primaryButtonText}>Connect to Server</Text>
        </Pressable>
        
        <Pressable 
          style={styles.secondaryButton}
          onPress={() => setShowServerInput(true)}
        >
          <Text style={styles.secondaryButtonText}>Configure Server</Text>
        </Pressable>
      </View>
      
      {/* Server configuration modal */}
      <Modal
        visible={showServerInput}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowServerInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Server Configuration</Text>
            
            <Text style={styles.inputLabel}>Server URL</Text>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://10.27.147.68:3000"
              placeholderTextColor="#888"
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <Text style={styles.modalHelpText}>
              Enter the IP address of the device running the server.
              Make sure both devices are on the same WiFi network.
            </Text>
            
            <View style={styles.modalButtons}>
              <Pressable 
                style={styles.modalCancelButton}
                onPress={() => setShowServerInput(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </Pressable>
              
              <Pressable 
                style={styles.modalSaveButton}
                onPress={() => {
                  setShowServerInput(false);
                  handleConnect();
                }}
              >
                <Text style={styles.modalSaveButtonText}>Save & Connect</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  const renderConnectingScreen = () => (
    <View style={styles.contentContainer}>
      <Text style={styles.titleText}>
        Connected!
      </Text>
      
      <Text style={styles.inputLabel}>Your Name</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        placeholder="Enter your name"
        placeholderTextColor="#888"
      />
      
      <View style={styles.optionsContainer}>
        <Pressable 
          style={styles.optionButton}
          onPress={() => setConnectionStep('host')}
        >
          <Ionicons name="add-circle" size={24} color="#8E44AD" />
          <Text style={styles.optionButtonText}>Create a Game</Text>
        </Pressable>
        
        <Pressable 
          style={styles.optionButton}
          onPress={() => setConnectionStep('join')}
        >
          <Ionicons name="log-in" size={24} color="#8E44AD" />
          <Text style={styles.optionButtonText}>Join a Game</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderHostScreen = () => (
    <View style={styles.contentContainer}>
      <Text style={styles.titleText}>
        Create a Game
      </Text>
      
      <Text style={styles.inputLabel}>Game Name</Text>
      <TextInput
        style={styles.input}
        value={gameName}
        onChangeText={setGameName}
        placeholder="Enter game name"
        placeholderTextColor="#888"
      />
      
      <Text style={styles.inputLabel}>Number of Rounds</Text>
      <View style={styles.roundsSelector}>
        {[2, 3, 4, 5, 6, 7, 8].map((num) => (
          <TouchableOpacity
            key={num}
            style={[
              styles.roundButton,
              selectedRounds === num && styles.roundButtonSelected
            ]}
            onPress={() => setSelectedRounds(num)}
          >
            <Text 
              style={[
                styles.roundButtonText,
                selectedRounds === num && styles.roundButtonTextSelected
              ]}
            >
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <Pressable 
        style={[
          styles.primaryButton, 
          !gameName.trim() && styles.disabledButton
        ]}
        onPress={handleCreateGame}
        disabled={!gameName.trim()}
      >
        <Text style={styles.primaryButtonText}>Create Game</Text>
      </Pressable>
    </View>
  );

  const renderJoinScreen = () => (
    <View style={styles.contentContainer}>
      <Text style={styles.titleText}>
        Join a Game
      </Text>
      
      <View style={styles.connectionStatusContainer}>
        <View style={[
          styles.connectionIndicator, 
          isConnected ? styles.connectionActive : styles.connectionInactive
        ]} />
        <Text style={styles.connectionStatusText}>
          {isConnected ? 'Connected to server' : 'Not connected'}
        </Text>
      </View>
      
      <Text style={styles.inputLabel}>Game Code</Text>
      <TextInput
        style={styles.input}
        value={joinCode}
        onChangeText={(text) => setJoinCode(text.toUpperCase())}
        placeholder="Enter game code"
        placeholderTextColor="#888"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={20}
        onSubmitEditing={handleJoinGame}
      />
      
      <Pressable 
        style={[
          styles.primaryButton, 
          (!joinCode.trim() || !isConnected) && styles.disabledButton
        ]}
        onPress={handleJoinGame}
        disabled={!joinCode.trim() || !isConnected}
      >
        <Text style={styles.primaryButtonText}>Join Game</Text>
      </Pressable>
      
      {!isConnected && (
        <Pressable 
          style={styles.reconnectButton}
          onPress={() => handleConnect()}
        >
          <Text style={styles.reconnectButtonText}>Reconnect to Server</Text>
        </Pressable>
      )}
    </View>
  );

  const renderLobbyScreen = () => {
    // Generate join info for the QR code - using URL format for better compatibility with QR scanners
    const joinUrl = `synth://join?gameId=${gameId}&serverUrl=${encodeURIComponent(serverUrl || "http://10.32.170.64:3000")}&gameName=${encodeURIComponent(gameState.name || gameName)}`;
    
    return (
    <View style={styles.contentContainer}>
      <View style={styles.lobbyHeader}>
        <Text style={styles.lobbyTitle}>{gameState.name || gameName}</Text>
        <View style={styles.gameCodeContainer}>
          <Text style={styles.gameCodeLabel}>GAME CODE</Text>
          <Text style={styles.gameCode}>{gameId}</Text>
          <Pressable
            style={styles.qrButton}
            onPress={() => setShowQrCode(true)}
          >
            <Ionicons name="qr-code" size={20} color="#FFC857" />
            <Text style={styles.qrButtonText}>Show QR</Text>
          </Pressable>
        </View>
        <View style={styles.roundInfoContainer}>
          <Text style={styles.gameInfoLabel}>Rounds: </Text>
          <Text style={styles.gameInfoValue}>{gameState.maxRounds || selectedRounds}</Text>
        </View>
      </View>
      
      {/* QR Code Modal */}
      <Modal
        visible={showQrCode}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQrCode(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            <Text style={styles.modalTitle}>Join Game</Text>
            <Text style={styles.qrInstructions}>Scan this code with another device to join</Text>
            
            <View style={styles.qrCodeContainer}>
              <QRCode
                value={joinUrl}
                size={200}
                backgroundColor="white"
                color="black"
              />
            </View>
            
            <View style={styles.gameInfoContainer}>
              <Text style={styles.gameInfoLabel}>Game Code:</Text>
              <Text style={styles.gameInfoValue}>{gameId}</Text>
            </View>
            
            <Text style={styles.manualInstructions}>
              On your device, enter this code in the "Join Game" screen
            </Text>
            
            <Pressable 
              style={styles.modalCloseButton}
              onPress={() => setShowQrCode(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      
      <View style={styles.playersContainer}>
        <View style={styles.playersHeaderRow}>
          <Text style={styles.playersTitle}>Players</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={refreshGameState}
          >
            <Ionicons name="refresh" size={20} color="#8E44AD" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={players}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.playerItem}>
              <View style={styles.playerIconContainer}>
                <Text style={styles.playerIcon}>{item.username.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.playerName}>{item.username}</Text>
              {item.ready && <Ionicons name="checkmark-circle" size={24} color="#4BB543" />}
              {gameState.host === item.id && <Text style={styles.hostBadge}>Host</Text>}
            </View>
          )}
          style={styles.playersList}
        />
      </View>
      
      <View style={styles.lobbyButtonsContainer}>
        {isHost ? (
          <Pressable 
            style={[
              styles.startButton, 
              (!allPlayersReady || players.length < 2) && styles.disabledButton
            ]}
            onPress={handleStartGame}
            disabled={!allPlayersReady || players.length < 2}
          >
            <Text style={styles.startButtonText}>Start Game</Text>
          </Pressable>
        ) : (
          <Pressable 
            style={[
              styles.readyButton, 
              isReady && styles.readyButtonActive
            ]}
            onPress={handleReady}
            disabled={isReady}
          >
            <Text style={styles.readyButtonText}>
              {isReady ? "Ready!" : "Ready Up"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  )};

  // Main rendering logic based on current step
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8E44AD" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }
    
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
          
          <Pressable 
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              if (connectionStep === 'initial') {
                handleConnect();
              }
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    
    switch (connectionStep) {
      case 'initial':
        return renderInitialScreen();
      case 'connecting':
        return renderConnectingScreen();
      case 'host':
        return renderHostScreen();
      case 'join':
        return renderJoinScreen();
      case 'lobby':
        return renderLobbyScreen();
      default:
        return renderInitialScreen();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderContent()}
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
  contentContainer: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 200,
    height: 80,
    marginBottom: 40,
  },
  welcomeText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  infoText: {
    color: "#CCC",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  buttonsContainer: {
    width: "100%",
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#8E44AD",
    width: "80%",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 7,
    elevation: 5,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#8E44AD",
    width: "80%",
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#8E44AD",
    fontSize: 16,
    fontWeight: "bold",
  },
  disabledButton: {
    backgroundColor: "#666",
    opacity: 0.7,
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
    backgroundColor: "#8E44AD",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  titleText: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
  },
  inputLabel: {
    color: "white",
    fontSize: 16,
    alignSelf: "flex-start",
    marginLeft: "10%",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#2A2A2A",
    width: "80%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
    color: "white",
    fontSize: 18,
    padding: 14,
    marginBottom: 24,
  },
  optionsContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: 20,
  },
  optionButton: {
    backgroundColor: "#222",
    borderRadius: 16,
    padding: 20,
    width: "45%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#444",
  },
  optionButtonText: {
    color: "white",
    fontSize: 16,
    marginTop: 12,
    textAlign: "center",
  },
  lobbyHeader: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  lobbyTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  gameCodeContainer: {
    backgroundColor: "#2A2A2A",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  gameCodeLabel: {
    color: "#999",
    fontSize: 12,
    marginBottom: 4,
  },
  gameCode: {
    color: "#FFC857",
    fontSize: 24,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  playersContainer: {
    width: "100%",
    flex: 1,
    marginVertical: 20,
  },
  playersTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  playersList: {
    width: "100%",
  },
  playerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#444",
  },
  playerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#8E44AD",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  playerIcon: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  playerName: {
    color: "white",
    fontSize: 18,
    flex: 1,
  },
  hostBadge: {
    backgroundColor: "#FFC857",
    color: "#000",
    fontSize: 12,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  lobbyButtonsContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: "#C143FF",
    width: "80%",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 7,
    elevation: 5,
  },
  startButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  readyButton: {
    backgroundColor: "#333",
    width: "80%",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#4BB543",
  },
  readyButtonActive: {
    backgroundColor: "rgba(75, 181, 67, 0.2)",
  },
  readyButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#222",
    width: "80%",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#444",
  },
  modalTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  modalCancelButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    flex: 1,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#444",
  },
  modalCancelButtonText: {
    color: "#CCC",
    fontSize: 16,
  },
  modalSaveButton: {
    backgroundColor: "#8E44AD",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    flex: 1,
    marginLeft: 8,
  },
  modalSaveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalHelpText: {
    fontSize: 14,
    color: "#888",
    marginTop: 8,
    marginBottom: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  connectionStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  connectionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 10,
  },
  connectionActive: {
    backgroundColor: "#4BB543",
  },
  connectionInactive: {
    backgroundColor: "#FF6B6B",
  },
  connectionStatusText: {
    color: "white",
    fontSize: 16,
  },
  reconnectButton: {
    backgroundColor: "#8E44AD",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginTop: 16,
  },
  reconnectButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  playersHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(142, 68, 173, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  refreshButtonText: {
    color: '#8E44AD',
    marginLeft: 4,
    fontSize: 14,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  qrButtonText: {
    color: '#FFC857',
    marginLeft: 4,
    fontSize: 14,
    fontWeight: 'bold',
  },
  qrModalContent: {
    backgroundColor: '#222',
    width: '80%',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  qrInstructions: {
    color: '#CCC',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  qrCodeContainer: {
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 20,
  },
  gameInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  gameInfoLabel: {
    color: '#FFC857',
    fontSize: 14,
    fontWeight: 'bold',
  },
  gameInfoValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    backgroundColor: '#8E44AD',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 20,
  },
  modalCloseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  manualInstructions: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  roundsSelector: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 20,
  },
  roundButton: {
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  roundButtonSelected: {
    backgroundColor: '#8E44AD',
  },
  roundButtonText: {
    color: '#CCC',
    fontSize: 16,
  },
  roundButtonTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  roundInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
}); 