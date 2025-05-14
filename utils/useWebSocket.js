import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Alert, Platform } from 'react-native';
import { DeviceEventEmitter } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';

// Socket.io events
export const EVENTS = {
  // Server events
  GAME_CREATED: 'game_created',
  PLAYER_JOINED: 'player_joined',
  GAME_UPDATED: 'game_updated',
  GAME_STARTED: 'game_started',
  SONG_SELECTED: 'song_selected',
  VOTE_RESULT: 'vote_result',
  PLAYER_VOTED: 'player_voted',
  ROUND_COMPLETE: 'round_complete',
  ROUND_STARTED: 'round_started',
  GAME_COMPLETED: 'game_completed',
  GAME_RESTARTED: 'game_restarted',
  HOST_CHANGED: 'host_changed',
  PLAYER_LEFT: 'player_left',
  PLAYER_TRACKS_RECEIVED: 'player_tracks_received',
  PLAYLIST_SHARED: 'playlist_shared',
  FORCE_SONG_SYNC: 'force_song_sync',
  ERROR: 'error',
  
  // Client events
  CREATE_GAME: 'create_game',
  JOIN_GAME: 'join_game',
  PLAYER_READY: 'player_ready',
  START_GAME: 'start_game',
  SELECT_SONG: 'select_song',
  CAST_VOTE: 'cast_vote',
  NEXT_ROUND: 'next_round',
  RESTART_GAME: 'restart_game',
  SONG_PLAYING: 'song_playing',
  
  // New sync events
  SONG_RECEIVED: 'song_received',
  HOST_PLAYBACK_STATUS: 'host_playback_status',
  SYNC_STATUS: 'sync_status',
};

// Constants
// For development, you can use 'http://localhost:3000'
// For production, you'll need to use the actual server IP
// Use your specific IP address when you want to test with multiple devices
const DEFAULT_SERVER_URL = 'http://172.20.10.10:3000'; 
const CONNECTION_TIMEOUT = 20000; // 10 seconds

// Create a singleton socket instance that persists across component mounts
let globalSocket = null;
let globalConnected = false;
let globalError = null;
let globalServerUrl = null;
let connectionErrorCount = 0;

export const useWebSocket = () => {
  const [socket, setSocket] = useState(globalSocket);
  const [isConnected, setIsConnected] = useState(globalConnected);
  const [error, setError] = useState(globalError);
  const [serverUrl, setServerUrl] = useState(globalServerUrl);
  const timeoutRef = useRef(null);
  const connectedRef = useRef(globalConnected);
  const connectionErrorsRef = useRef(connectionErrorCount);
  
  // Update global state when local state changes
  useEffect(() => {
    globalSocket = socket;
    globalConnected = isConnected;
    globalError = error;
    globalServerUrl = serverUrl;
    connectionErrorCount = connectionErrorsRef.current;
  }, [socket, isConnected, error, serverUrl, connectionErrorsRef.current]);
  
  // Get the server URL
  const getServerUrl = useCallback(async () => {
    try {
      // For simplicity during development, always try localhost first
      if (__DEV__) {
        console.log('Running in development mode, using localhost server');
        
        // For iOS simulators, localhost works
        if (Platform.OS === 'ios' && !Constants.isDevice) {
          return 'http://localhost:3000';
        } 
        
        // For Android emulators, use 10.0.2.2 instead of localhost
        if (Platform.OS === 'android' && !Constants.isDevice) {
          return 'http://10.0.2.2:3000';
        }
        
        // For physical devices, try localhost first - the server may be running on the same device
        // This ensures more reliable connections in development setups
        return 'http://localhost:3000';
      }
      
      // For production, use DEFAULT_SERVER_URL
      return DEFAULT_SERVER_URL;
    } catch (err) {
      console.error('Error determining server URL:', err);
      
      // Fallback to localhost as a last resort
      return 'http://localhost:3000';
    }
  }, []);
  
  // Connect to the WebSocket server
  const connect = useCallback(async (url = null) => {
    // If we already have a global socket that's connected, just use that
    if (globalSocket && globalConnected) {
      console.log('Using existing global WebSocket connection');
      setSocket(globalSocket);
      setIsConnected(globalConnected);
      setError(globalError);
      setServerUrl(globalServerUrl);
      connectedRef.current = globalConnected;
      connectionErrorsRef.current = connectionErrorCount;
      return globalSocket;
    }
    
    try {
      // Check network status first
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected) {
        const noNetworkError = 'No network connection. Please connect to WiFi and try again.';
        setError(noNetworkError);
        globalError = noNetworkError;
        return null;
      }
      
      // Get the server URL if not provided
      const serverAddress = url || await getServerUrl();
      setServerUrl(serverAddress);
      globalServerUrl = serverAddress;
      
      // Clear any existing socket
      if (globalSocket) {
        try {
          globalSocket.disconnect();
        } catch (disconnectError) {
          console.error('Error disconnecting existing socket:', disconnectError);
        }
      }
      
      // Create socket with error handling - improved configuration for stability
      console.log(`Connecting to WebSocket server at ${serverAddress}...`);
      
      // Use better socket.io configuration for improved reliability
      const newSocket = io(serverAddress, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        timeout: CONNECTION_TIMEOUT,
        transports: ['websocket', 'polling'],  // Allow both WebSocket and polling
        upgrade: true,  // Allow transport upgrade
        forceNew: true,
        autoConnect: true,
        pingTimeout: 8000,
        pingInterval: 10000
      });
      
      // Set connection timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        if (!connectedRef.current) {
          console.log('Connection timeout');
          const timeoutError = 'Connection timeout. Please check the server URL and try again.';
          setError(timeoutError);
          globalError = timeoutError;
          
          if (newSocket) {
            try {
              newSocket.disconnect();
            } catch (e) {
              console.error('Error disconnecting socket after timeout:', e);
            }
          }
        }
      }, CONNECTION_TIMEOUT);
      
      // Connection events
      newSocket.on('connect', () => {
        console.log('Connected to WebSocket server!');
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        setIsConnected(true);
        globalConnected = true;
        connectedRef.current = true;
        
        setError(null);
        globalError = null;
        
        // Reset connection error count
        connectionErrorsRef.current = 0;
        connectionErrorCount = 0;
        
        // Update socket references
        setSocket(newSocket);
        globalSocket = newSocket;
        
        // Broadcast connection success to other components
        DeviceEventEmitter.emit('websocket_connected', { socket: newSocket });
      });
      
      newSocket.on('connect_error', (err) => {
        console.error('Connection error:', err);
        const connectError = `Connection error: ${err.message}`;
        setError(connectError);
        globalError = connectError;
        
        // Track connection errors
        connectionErrorsRef.current += 1;
        connectionErrorCount = connectionErrorsRef.current;
        console.log(`Connection error count: ${connectionErrorsRef.current}`);
        
        // If we have too many connection errors, stop trying
        if (connectionErrorsRef.current > 5) {
          console.log('Too many connection errors, stopping reconnection attempts');
          try {
            newSocket.io.opts.reconnection = false;
          } catch (e) {
            console.error('Error disabling reconnection:', e);
          }
          
          // Notify user about persistent connection issues
          Alert.alert(
            "Connection Problem",
            "Unable to connect to the game server. Please check your network connection and restart the game.",
            [{ text: "OK" }]
          );
        }
      });
      
      newSocket.on('disconnect', (reason) => {
        console.log(`Disconnected: ${reason}`);
        setIsConnected(false);
        globalConnected = false;
        connectedRef.current = false;
        
        // Update error message based on reason
        let disconnectError = null;
        if (reason === 'io server disconnect') {
          disconnectError = 'Disconnected by the server. Please reconnect.';
        } else if (reason === 'transport close') {
          disconnectError = 'Connection lost. Please check your WiFi connection.';
        } else {
          disconnectError = `Connection lost: ${reason}`;
        }
        
        setError(disconnectError);
        globalError = disconnectError;
        
        // Broadcast disconnection to other components
        DeviceEventEmitter.emit('websocket_disconnected', { reason });
      });
      
      // Add specific error handler for transport errors
      newSocket.io.on('error', (err) => {
        console.error('Transport error:', err);
        
        // Try to recover by forcing a new connection after a delay
        setTimeout(() => {
          try {
            if (newSocket && !newSocket.connected) {
              console.log('Attempting recovery from transport error...');
              newSocket.io.reconnection(true);
              newSocket.connect();
            }
          } catch (e) {
            console.error('Error during transport error recovery:', e);
          }
        }, 2000);
      });
      
      // Error handling
      newSocket.on(EVENTS.ERROR, (data) => {
        console.log('Server error:', data);
        Alert.alert('Error', data.message || 'An unknown error occurred');
      });
      
      setSocket(newSocket);
      globalSocket = newSocket;
      
      return newSocket;
    } catch (err) {
      console.error('Error connecting to WebSocket:', err);
      const connectError = `Error connecting: ${err.message}`;
      setError(connectError);
      globalError = connectError;
      setIsConnected(false);
      globalConnected = false;
      connectedRef.current = false;
      return null;
    }
  }, [getServerUrl]);
  
  // Disconnect from the WebSocket server - keep this function 
  // but only use it when explicitly requested
  const disconnect = useCallback(() => {
    if (socket) {
      console.log('Disconnecting from WebSocket server...');
      socket.disconnect();
      setSocket(null);
      globalSocket = null;
      setIsConnected(false);
      globalConnected = false;
      connectedRef.current = false;
      
      // Clean up any pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [socket]);
  
  // Listen for events with improved reliability
  const on = useCallback((event, callback) => {
    if (!socket) {
      console.warn(`Cannot register event ${event}: socket is null`);
      return () => {};
    }
    
    // Add debug logging for specific events
    const wrappedCallback = (...args) => {
      // Log special sync-related events
      if ([EVENTS.SONG_RECEIVED, EVENTS.HOST_PLAYBACK_STATUS, EVENTS.SYNC_STATUS].includes(event)) {
        console.log(`[SYNC] Received ${event} event:`, 
          args[0]?.gameId || 'unknown game',
          args[0]?.roundNumber || 'unknown round',
          args[0]?.songTitle ? `song: ${args[0].songTitle}` : ''
        );
      }
      
      // For all events, execute the callback
      return callback(...args);
    };
    
    socket.on(event, wrappedCallback);
    
    // Return a cleanup function
    return () => {
      socket.off(event, wrappedCallback);
    };
  }, [socket]);
  
  // Emit events with enhanced error handling
  const emit = useCallback((event, data, callback) => {
    if (!socket || !isConnected) {
      console.warn(`Cannot emit ${event}: socket not connected`);
      return false;
    }
    
    try {
      // Safely serialize data to avoid circular references
      const safeData = JSON.parse(JSON.stringify(data));
      
      console.log(`Emitting ${event}:`, safeData);
      
      if (callback) {
        socket.emit(event, safeData, callback);
      } else {
        socket.emit(event, safeData);
      }
      
      // If this is a select_song event, log extra debugging info
      if (event === EVENTS.SELECT_SONG) {
        console.log(`DEBUG: Sent song selection. Preview URL: ${safeData.song?.previewUrl}`);
        console.log(`DEBUG: Assigned to player: ${JSON.stringify(safeData.assignedPlayer)}`);
      }
      
      return true;
    } catch (err) {
      console.error(`Error emitting ${event}:`, err);
      
      // For important events, try a simplified fallback
      if ([EVENTS.SELECT_SONG, EVENTS.CAST_VOTE, EVENTS.NEXT_ROUND].includes(event)) {
        try {
          console.log(`Attempting simplified emission for ${event}`);
          
          // Create a minimal object with just the essentials
          const minimalData = { ...data };
          
          // Handle specific events
          if (event === EVENTS.SELECT_SONG && minimalData.song) {
            minimalData.song = {
              songTitle: minimalData.song.songTitle || 'Unknown Song',
              previewUrl: minimalData.song.previewUrl || '',
              imageUrl: minimalData.song.imageUrl || ''
            };
            minimalData.assignedPlayer = {
              username: minimalData.assignedPlayer?.username || 'Unknown User'
            };
          }
          
          socket.emit(event, minimalData);
          return true;
        } catch (fallbackErr) {
          console.error(`Fallback emission also failed for ${event}:`, fallbackErr);
          return false;
        }
      }
      
      return false;
    }
  }, [socket, isConnected]);
  
  // Create a game
  const createGame = useCallback((gameData) => {
    return emit(EVENTS.CREATE_GAME, gameData);
  }, [emit]);
  
  // Join a game
  const joinGame = useCallback((gameId, username, profilePicture = null, playerTracks = null) => {
    // Extra validation and improved error handling
    if (!gameId || !username) {
      console.warn('Invalid gameId or username for join_game');
      return false;
    }
    
    // Check if connected first
    if (!socket || !isConnected) {
      console.warn('Cannot emit join_game: socket not connected');
      
      // If we're not connected, attempt to reconnect
      if (socket) {
        console.log('Attempting to reconnect before joining...');
        socket.connect();
        
        // Try joining after a short delay to give connection time to establish
        setTimeout(() => {
          if (socket.connected) {
            console.log('Reconnected, now joining game...');
            socket.emit(EVENTS.JOIN_GAME, { gameId, username, profilePicture, playerTracks });
          } else {
            console.warn('Reconnection failed, still unable to join game');
          }
        }, 1000);
      }
      
      return false;
    }
    
    // Log tracks being sent for debugging
    if (playerTracks && playerTracks.length > 0) {
      console.log(`Sending ${playerTracks.length} tracks when joining game ${gameId}`);
      // Log sample track info
      console.log('Sample track info:', {
        title: playerTracks[0].songTitle,
        hasPreviewUrl: !!playerTracks[0].previewUrl
      });
    } else {
      console.warn('No tracks available when joining game');
    }
    
    // If we're already connected, proceed normally
    return emit(EVENTS.JOIN_GAME, { gameId, username, profilePicture, playerTracks });
  }, [socket, isConnected, emit]);
  
  // Mark player as ready
  const playerReady = useCallback((gameId) => {
    return emit(EVENTS.PLAYER_READY, { gameId });
  }, [emit]);
  
  // Start the game
  const startGame = useCallback((gameId) => {
    return emit(EVENTS.START_GAME, { gameId });
  }, [emit]);
  
  // Select a song for a round
  const selectSong = useCallback((gameId, song, assignedPlayer) => {
    console.log(`Selecting song for game ${gameId}: ${song?.songTitle}`);
    
    // First, make sure the song has a valid preview URL
    if (!song || !song.previewUrl) {
      console.warn(`Cannot select song without valid preview URL: ${song?.songTitle}`);
      
      // Don't attempt to send songs without preview URLs
      if (!song?.previewUrl) {
        return false;
      }
    }
    
    // Prepare sanitized song data to prevent circular references
    // We'll create a completely new object with only the required properties
    const sanitizedSong = {
      songTitle: song.songTitle || '',
      songArtists: Array.isArray(song.songArtists) ? [...song.songArtists] : [],
      albumName: song.albumName || '',
      imageUrl: song.imageUrl || '',
      duration: song.duration || 0,
      previewUrl: song.previewUrl || '',  // Always include previewUrl for all players
      uri: song.uri || null,
      externalUrl: song.externalUrl || null,
      trackId: song.trackId || song.id || null
    };
    
    // Ensure the assignedPlayer is valid and only includes essential properties
    const validAssignedPlayer = {
      username: assignedPlayer?.username || 'Unknown User',
      id: assignedPlayer?.id || 'unknown'
    };
    
    // Log the song selection for debugging
    console.log(`Sending song selection to server - Title: ${sanitizedSong.songTitle}, Preview URL: ${sanitizedSong.previewUrl?.substring(0, 30)}...`);
    console.log(`Song assigned to player: ${JSON.stringify(validAssignedPlayer)}`);
    
    // Add additional error handling when emitting the event
    try {
      // Use a stringify-parse cycle to ensure no circular references
      const cleanData = JSON.parse(JSON.stringify({ 
        gameId, 
        song: sanitizedSong, 
        assignedPlayer: validAssignedPlayer 
      }));
      
      return emit(EVENTS.SELECT_SONG, cleanData);
    } catch (err) {
      console.error("Error serializing song data for WebSocket:", err);
      Alert.alert(
        "Connection Error",
        "Failed to send song data. Trying a simplified version."
      );
      
      // Try again with an even more simplified object
      try {
        const fallbackData = {
          gameId,
          song: {
            songTitle: song.songTitle || 'Unknown Song',
            previewUrl: song.previewUrl || '',  // Make sure this is included in fallback
            imageUrl: song.imageUrl || ''
          },
          assignedPlayer: {
            username: assignedPlayer?.username || 'Unknown User'
          }
        };
        
        return emit(EVENTS.SELECT_SONG, fallbackData);
      } catch (fallbackErr) {
        console.error("Fallback also failed:", fallbackErr);
        return false;
      }
    }
  }, [emit]);
  
  // Cast a vote for a player
  const castVote = useCallback((gameId, votedForUsername, options = {}) => {
    const payload = { 
      gameId, 
      votedForUsername,
      // Include additional options if provided (like player ID)
      ...options
    };
    
    console.log(`Emitting ${EVENTS.CAST_VOTE} for game ${gameId}`);
    return emit(EVENTS.CAST_VOTE, payload);
  }, [emit]);
  
  // Advance to the next round
  const nextRound = useCallback((gameId) => {
    console.log(`Requesting next round for game ${gameId}`);
    
    // Add double-check for connection status and retry with more logging
    if (!socket || !isConnected) {
      console.warn('Cannot request next round: socket not connected');
      
      // Try to reconnect if possible
      if (socket) {
        console.log('Attempting to reconnect before requesting next round...');
        socket.connect();
        
        // Try again after a short delay
        setTimeout(() => {
          if (socket.connected) {
            console.log('Reconnected, now requesting next round...');
            socket.emit(EVENTS.NEXT_ROUND, { gameId });
            return true;
          } else {
            console.warn('Reconnection failed, unable to request next round');
            return false;
          }
        }, 1000);
      }
      
      return false;
    }
    
    // Add extra logging for debugging round transitions
    console.log(`Emitting ${EVENTS.NEXT_ROUND} for game ${gameId}`);
    const success = emit(EVENTS.NEXT_ROUND, { gameId });
    console.log(`Next round request ${success ? 'succeeded' : 'failed'}`);
    
    return success;
  }, [socket, isConnected, emit]);
  
  // Restart the game
  const restartGame = useCallback((gameId) => {
    return emit(EVENTS.RESTART_GAME, { gameId });
  }, [emit]);
  
  // Clean up on unmount - but don't actually close the socket
  // to maintain persistence across screens
  useEffect(() => {
    return () => {
      // Just clean up timeout without disconnecting the socket
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Note: We don't disconnect the socket on unmount anymore
      // This keeps the connection alive between screen transitions
    };
  }, []);
  
  return {
    socket,
    isConnected,
    error,
    serverUrl,
    connect,
    disconnect,
    on,
    emit,
    // Game-specific functions
    createGame,
    joinGame,
    playerReady,
    startGame,
    selectSong,
    castVote,
    nextRound,
    restartGame,
  };
}; 