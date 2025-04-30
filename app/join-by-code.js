import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWebSocket, EVENTS } from "../utils/useWebSocket";

export default function JoinByCode() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Get params from QR code
  const gameId = params.gameId || '';
  const serverUrl = params.serverUrl || '';
  const gameName = params.gameName || 'Game';
  
  const {
    connect,
    isConnected,
    error: wsError,
    joinGame,
    playerReady,
    on,
  } = useWebSocket();
  
  // State
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  
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
  
  // Set header options
  useEffect(() => {
    navigation.setOptions({
      header: () => (
        <View style={styles.header}>
          <Pressable
            style={styles.menuButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Join Game</Text>
          </View>
          <View style={[styles.placeholder, { width: 44 }]} />
        </View>
      ),
    });
  }, [navigation, router]);
  
  // Connect to server when component mounts
  useEffect(() => {
    if (serverUrl) {
      handleConnect();
    }
  }, [serverUrl]);
  
  // Register WebSocket event listeners
  useEffect(() => {
    if (!isConnected) return;
    
    setConnected(true);
    
    // Player joined event
    const playerJoinedCleanup = on(EVENTS.PLAYER_JOINED, (data) => {
      console.log('Player joined:', data);
      
      // Navigate to the multiplayer game screen
      router.push({
        pathname: "/multiplayer-game",
      });
    });
    
    // Error event
    const errorCleanup = on(EVENTS.ERROR, (data) => {
      console.log('Error:', data);
      setError(data.message);
      setLoading(false);
    });
    
    // Cleanup function
    return () => {
      playerJoinedCleanup();
      errorCleanup();
    };
  }, [isConnected, on, router]);
  
  // Handle WebSocket connection status changes
  useEffect(() => {
    if (wsError) {
      setError(wsError);
      setLoading(false);
      setConnected(false);
    }
  }, [wsError]);
  
  // Connect to server
  const handleConnect = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await connect(serverUrl);
    } catch (err) {
      setError(`Failed to connect: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [connect, serverUrl]);
  
  // Join the game
  const handleJoinGame = useCallback(() => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    
    if (!gameId) {
      setError('No game ID provided');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Save username
    AsyncStorage.setItem('multiplayer_username', username).catch(err => {
      console.error('Error saving username:', err);
    });
    
    // Join the game
    joinGame(gameId, username);
    
    // Set a timeout in case we don't get a response
    setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('Joining game timed out. Please try again.');
      }
    }, 10000);
  }, [username, gameId, joinGame, loading]);
  
  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8E44AD" />
          <Text style={styles.loadingText}>
            {connected ? 'Joining game...' : 'Connecting to server...'}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
          
          <Pressable 
            style={styles.retryButton}
            onPress={handleConnect}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          <View style={styles.gameInfoBox}>
            <Text style={styles.gameInfoTitle}>Game Details</Text>
            <Text style={styles.gameInfoText}>Name: {gameName}</Text>
            <View style={styles.codeDisplayContainer}>
              <Text style={styles.gameInfoLabel}>Code:</Text>
              <Text style={styles.gameCodeValue}>{gameId}</Text>
            </View>
          </View>
          
          <Text style={styles.inputLabel}>Your Name</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your name"
            placeholderTextColor="#888"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <Pressable 
            style={[
              styles.joinButton, 
              (!username.trim() || !isConnected) && styles.disabledButton
            ]}
            onPress={handleJoinGame}
            disabled={!username.trim() || !isConnected}
          >
            <Text style={styles.joinButtonText}>Join Game</Text>
          </Pressable>
          
          <View style={styles.connectionStatusContainer}>
            <View style={[
              styles.connectionIndicator, 
              isConnected ? styles.connectionActive : styles.connectionInactive
            ]} />
            <Text style={styles.connectionStatusText}>
              {isConnected ? 'Connected to server' : 'Not connected to server'}
            </Text>
          </View>
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
  contentContainer: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  gameInfoBox: {
    backgroundColor: "#2A2A2A",
    width: "100%",
    borderRadius: 8,
    padding: 16,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "#444",
  },
  gameInfoTitle: {
    color: "#FFC857",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  gameInfoText: {
    color: "white",
    fontSize: 16,
    marginVertical: 2,
  },
  inputLabel: {
    color: "white",
    fontSize: 16,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#2A2A2A",
    width: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
    color: "white",
    fontSize: 18,
    padding: 14,
    marginBottom: 24,
  },
  joinButton: {
    backgroundColor: "#8E44AD",
    width: "100%",
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
  joinButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  disabledButton: {
    backgroundColor: "#666",
    opacity: 0.7,
  },
  connectionStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
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
  codeDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  gameCodeValue: {
    color: '#FFC857',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginLeft: 8,
  },
  gameInfoLabel: {
    color: "white",
    fontSize: 16,
  },
}); 