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
  Platform,
} from "react-native";
import { useNavigation, useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
// Only import Slider for non-web platforms
let Slider;
if (Platform.OS !== 'web') {
  Slider = require("@react-native-community/slider").default;
}
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
} from "../utils/deezerApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import VotingStage from "./VotingStage";
import ResultsStage from "./ResultsStage";
// Import useWebSocket for multiplayer functionality
import { useWebSocket, EVENTS } from "../utils/useWebSocket";
import LeaderboardScreen from "./LeaderboardScreen";
// import * as Analytics from "expo-firebase-analytics";
// import { initializeApp } from "firebase/app";
import { getAnalytics, logEvent } from "firebase/analytics";

const ALBUM_ID = "2noRn2Aes5aoNVsU6iWThc";
const MIN_PLAY_DURATION = 8000; // 8 seconds
const DEFAULT_ROUNDS = 3; // Default number of rounds if server doesn't provide a value
const MAX_SYNC_HISTORY = 10; // Number of trace IDs to keep track of

//const analytics = getAnalytics(app);
// Format time helper function
const formatTime = (milliseconds) => {
  if (!milliseconds) return "0:00";

  let totalSeconds = Math.floor(milliseconds / 1000);
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = totalSeconds % 60;

  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
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

  // Initialize the WebSocket hook for multiplayer
  const {
    on,
    emit,
    nextRound: sendNextRound,
    castVote,
    isConnected,
  } = useWebSocket();

  // Track the last few trace IDs we've received to avoid infinite sync loops
  const lastSyncTraceIds = useRef([]);
  const SYNC_THROTTLE_MS = 3000; // Only process force_sync events at most every 3 seconds

  // Also track when we processed each sync to add time-based throttling
  const lastSyncTimestamp = useRef(0);

  // Mock song data to fallback on if Spotify API is unavailable
  const mockSongs = [
    {
      songTitle: "A Day in the Life",
      songArtists: ["The Beatles"],
      albumName: "Sgt. Pepper's Lonely Hearts Club Band",
      imageUrl:
        "https://i.scdn.co/image/ab67616d0000b273128450651c9f0442780d8eb8",
      duration: 337000,
      previewUrl:
        "https://p.scdn.co/mp3-preview/67f504bf5b86bdcaf197aef343c2413e8ec68b1d",
      uri: "spotify:track:0jXR9dJLlGpfYQrN0m1HLO",
      externalUrl: "https://open.spotify.com/track/0jXR9dJLlGpfYQrN0m1HLO",
    },
    {
      songTitle: "Bohemian Rhapsody",
      songArtists: ["Queen"],
      albumName: "A Night at the Opera",
      imageUrl:
        "https://i.scdn.co/image/ab67616d0000b27328581cfe196c2be2506ee6c0",
      duration: 354000,
      previewUrl:
        "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/29/96/51/2996514a-35cd-b092-c7f0-dd995b0e6071/mzaf_10909209324710493166.plus.aac.p.m4a",
      uri: "spotify:track:7tFiyTwD0nx5a1eklYtX2J",
      externalUrl: "https://open.spotify.com/track/7tFiyTwD0nx5a1eklYtX2J",
    },
    {
      songTitle: "Hotel California",
      songArtists: ["Eagles"],
      albumName: "Hotel California",
      imageUrl:
        "https://i.scdn.co/image/ab67616d0000b273446e630d93d3fb235d70bad9",
      duration: 391000,
      previewUrl:
        "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/cb/16/81/cb1681bb-a5a7-0b93-7ce0-0a55ab6dc9e5/mzaf_11284427653219671407.plus.aac.p.m4a",
      uri: "spotify:track:40riOy7x9W7GXjyGp4pjAv",
      externalUrl: "https://open.spotify.com/track/40riOy7x9W7GXjyGp4pjAv",
    },
  ];

  // State variables
  const [isLoading, setIsLoading] = useState(false);
  const [allSongs, setAllSongs] = useState([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentSong, setCurrentSong] = useState(null);
  const [gameStage, setGameStage] = useState("loading"); // loading, playing, voting, leaderboard, results
  const [error, setError] = useState(null);
  const [playerSongs, setPlayerSongs] = useState({});
  const [hasFetchedSongs, setHasFetchedSongs] = useState(false);
  // NEW: Add state for the consolidated playlist
  const [consolidatedPlaylist, setConsolidatedPlaylist] = useState([]);
  // NEW: Add state for max rounds from server
  const [maxRounds, setMaxRounds] = useState(DEFAULT_ROUNDS);

  // Audio playback state variables
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [canVote, setCanVote] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioLoadError, setAudioLoadError] = useState(null);
  const audioLoadTimeoutRef = useRef(null);

  // Add state variable to track played songs
  const [playedSongs, setPlayedSongs] = useState([]);
  const [roundSongs, setRoundSongs] = useState({});

  // Add state variables for tracking voting selection and results
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showVoteResult, setShowVoteResult] = useState(false);
  const [trackAssignments, setTrackAssignments] = useState({});

  // Track points awarded for @cole_sprout (and add state for tracking this)
  const [playerPoints, setPlayerPoints] = useState({
    "@cole_sprout": 0,
  });

  // Add a state variable to track the voting progress percentage
  const [voteProgress, setVoteProgress] = useState(0);
  const playerRef = useRef(null);

  // Add state for tracking votes
  const [pendingVotes, setPendingVotes] = useState({});
  const [allVotesCast, setAllVotesCast] = useState(false);

  // Add state for tracking whether tracks have been shared
  const [hasSharedTracks, setHasSharedTracks] = useState(false);

  // Get game details from params
  const gameName = params.gameName || "Game Name";
  const playerCount = parseInt(params.playerCount) || 4;
  const gameId = params.gameId || `game-${Date.now()}`;
  // Update to read the multiplayer flag from params
  const isMultiplayer = params.isMultiplayer === "true";
  const isHost = params.isHost === "true";

  // Parse player data from params if available
  let playerData = [];
  try {
    if (params.players) {
      playerData = JSON.parse(params.players);
    }
  } catch (e) {
    console.error("Error parsing player data:", e);
  }

  // Create players array using full player data if available
  const players =
    playerData.length > 0
      ? playerData.map((player, index) => ({
          id: player.id || index + 1,
          username: player.username,
          platform: "spotify",
          profilePicture: player.profilePicture,
          displayName: player.displayName || player.username,
          spotifyId: player.spotifyId,
        }))
      : [
          { id: 1, username: "@luke_mcfall", platform: "spotify" },
          { id: 2, username: "@cole_sprout", platform: "spotify" },
          { id: 3, username: "@maya_avital", platform: "spotify" },
          { id: 4, username: "@marcus_lintott", platform: "spotify" },
        ].slice(0, playerCount);

  // Set header options and debug token
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

    console.log("Game started with params:", {
      gameName,
      playerCount,
      gameId,
      players: players.map((p) => p.username),
      albumId: ALBUM_ID,
    });
  }, [navigation]);

  // Debug token state changes
  useEffect(() => {
    console.log("Token state changed:", {
      hasToken: !!token,
      isInitialized,
      hasFetchedSongs,
    });
  }, [token, isInitialized, hasFetchedSongs]);

  // Add a helper function to process player points updates consistently
  const processPlayerPointsUpdate = useCallback((scoresData) => {
    console.log("[TRACK_SYNC] Processing playerPoints update:", scoresData);
    console.log("[TRACK_SYNC] Current players:", players);
    
    // Create a mapping of socket IDs to usernames for reliable score tracking
    const socketIdToUsername = {};
    players.forEach((player) => {
      if (player && player.id && player.username) {
        socketIdToUsername[player.id] = player.username;
        console.log(`[TRACK_SYNC] Mapped socket ID ${player.id} to username ${player.username}`);
      }
    });
    
    console.log("[TRACK_SYNC] Socket ID to username mapping:", socketIdToUsername);
    
    // Initialize new scores object using usernames as keys
    const updatedPoints = {};
    
    // Process the scores object from the server
    console.log("[TRACK_SYNC] Processing scores object:", scoresData);
    Object.entries(scoresData).forEach(([key, score]) => {
      console.log(`[TRACK_SYNC] Processing score entry: ${key} = ${score}`);
      
      // First try direct username match (if server sent scoresWithUsernames)
      const directUsernameMatch = players.find(p => p.username === key);
      if (directUsernameMatch) {
        console.log(`[TRACK_SYNC] Direct username match: ${key} = ${score}`);
        updatedPoints[key] = score;
        return;
      }
      
      // Try to find the player by socket ID
      let playerUsername = socketIdToUsername[key];
      
      if (!playerUsername) {
        // Try to find the player by ID in players array with various comparisons
        const player = players.find(
          (p) =>
            String(p.id) === String(key) || // Try string comparison
            p.id === Number(key) || // Try number conversion
            p.username === key // Username might be in ID field
        );

        if (player) {
          playerUsername = player.username;
          console.log(`[TRACK_SYNC] Found player by ID lookup: ${key} -> ${playerUsername}`);
        } else {
          console.warn(
            `[TRACK_SYNC] Could not find player for key: ${key}`
          );
          playerUsername = key; // Use key as fallback
        }
      } else {
        console.log(`[TRACK_SYNC] Mapped socket ID ${key} to username ${playerUsername}`);
      }

      // Update the score using username as key
      updatedPoints[playerUsername] = score;
    });
    
    // Add missing players with 0 points
    players.forEach((player) => {
      if (player && player.username && updatedPoints[player.username] === undefined) {
        console.log(`[TRACK_SYNC] Added missing score for ${player.username}: 0`);
        updatedPoints[player.username] = 0;
      }
    });

    console.log("[TRACK_SYNC] Final processed scores:", updatedPoints);
    console.log("[TRACK_SYNC] Updating playerPoints with processed scores");
    setPlayerPoints(updatedPoints);
    
    return updatedPoints;
  }, [players]);

  // Add this function to share tracks with the server
  const shareTracks = useCallback(
    async (tracksToShare) => {
      if (!emit || !isMultiplayer || !gameId) {
        console.log(
          "[TRACK_SYNC] Not sharing tracks - not in multiplayer mode or missing emit function"
        );
        return;
      }

      console.log(
        `[TRACK_SYNC] Preparing to share ${tracksToShare.length} tracks with server`
      );

      // Count how many have preview URLs already
      const tracksWithPreview = tracksToShare.filter((t) => !!t.previewUrl);
      console.log(
        `[TRACK_SYNC] ${tracksWithPreview.length}/${tracksToShare.length} tracks already have preview URLs`
      );

      let tracksToSend = tracksToShare;

      // If few or no tracks have preview URLs, try enriching with Deezer
      if (tracksWithPreview.length < 3) {
        console.log(
          "[TRACK_SYNC] Few tracks have preview URLs, attempting Deezer enrichment"
        );

        try {
          // Use enrichTracksWithDeezerPreviews to get Deezer previews
          const enrichedTracks = await enrichTracksWithDeezerPreviews(
            tracksToShare
          );
          const enrichedWithPreview = enrichedTracks.filter(
            (t) => !!t.previewUrl
          );

          console.log(
            `[TRACK_SYNC] After Deezer enrichment: ${enrichedWithPreview.length}/${enrichedTracks.length} tracks have preview URLs`
          );

          // Only use enriched tracks if they have more preview URLs
          if (enrichedWithPreview.length > tracksWithPreview.length) {
            console.log(
              "[TRACK_SYNC] Using Deezer-enriched tracks with more preview URLs"
            );
            tracksToSend = enrichedWithPreview;
          }
        } catch (error) {
          console.error(
            "[TRACK_SYNC] Error enriching tracks with Deezer:",
            error
          );
        }
      }

      // Send tracks to server
      console.log(
        `[TRACK_SYNC] Sharing ${tracksToSend.length} tracks with server`
      );
      console.log(
        `[TRACK_SYNC] ${
          tracksToSend.filter((t) => !!t.previewUrl).length
        } of these tracks have preview URLs`
      );

      // Attempt to send tracks to server
      try {
        emit("share_tracks", { gameId, tracks: tracksToSend });
        console.log("[TRACK_SYNC] Successfully shared tracks with server");
      } catch (error) {
        console.error("[TRACK_SYNC] Error sharing tracks with server:", error);
      }
    },
    [emit, gameId, isMultiplayer]
  );

  // Update the track fetching useEffect to call shareTracks:
  useEffect(() => {
    // Skip if we've already shared our tracks
    if (hasSharedTracks) return;

    // If we have songs and we're in multiplayer, share them with the server
    if (allSongs.length > 0 && isMultiplayer && emit && !hasSharedTracks) {
      console.log(
        `[TRACK_SYNC] First time with songs ready, sharing ${allSongs.length} tracks with server`
      );
      shareTracks(allSongs);
      setHasSharedTracks(true);
    }
  }, [allSongs, isMultiplayer, emit, hasSharedTracks, shareTracks]);

  // Fetch songs when component mounts - but only once
  useEffect(() => {
    // Skip if we've already fetched songs or if still loading
    if (allSongs.length > 0 || isLoading || !isInitialized) {
      return;
    }

    const fetchSongs = async () => {
      setIsLoading(true);
      setError(null);
      console.log("Starting fetchSongs function");
      console.log(
        "Token initialized:",
        isInitialized,
        "Token available:",
        !!token
      );

      let currentToken = token;

      // If we have a token, make sure it's valid before using it
      if (token) {
        try {
          console.log("Validating token...");
          // This will either return the valid token or refresh it automatically
          currentToken = await getValidToken();
          console.log(
            "Using valid token for API request:",
            currentToken ? "Token received" : "No token received"
          );
        } catch (error) {
          console.error("Error validating/refreshing token:", error);
          currentToken = null;
        }
      } else {
        console.log("No initial token available after initialization");

        // Give user option to authenticate if no token is available
        Alert.alert(
          "Spotify Authentication Needed",
          "No Spotify token available. Would you like to connect to Spotify?",
          [
            {
              text: "Use Sample Songs",
              onPress: () => console.log("Using sample songs only"),
              style: "cancel",
            },
            {
              text: "Connect to Spotify",
              onPress: async () => {
                try {
                  setIsLoading(false); // Reset loading state
                  await getSpotifyAuth(); // Start auth process
                  // Note: After successful auth, the token will be set and this effect will run again
                } catch (authError) {
                  console.error("Authentication error:", authError);
                  setIsLoading(false);
                  setError("Authentication failed. Using sample songs.");
                }
              },
            },
          ]
        );
      }

      let tracks;

      // If we don't have a valid token, use mock data
      if (!currentToken) {
        console.log("No valid Spotify token, using mock song data");
        console.log("Mock songs available:", mockSongs?.length || 0);
        tracks = mockSongs;
      } else {
        try {
          // First try getting recently played tracks as they often have preview URLs
          console.log("Fetching recently played tracks...");
          try {
            tracks = await getMyRecentlyPlayedTracks(currentToken);
            console.log(
              "Successfully fetched recently played tracks:",
              tracks?.length || 0
            );
          } catch (recentError) {
            console.error(
              "Error fetching recently played tracks:",
              recentError
            );
            tracks = null;
          }

          // If no recent tracks or error, try the album tracks
          if (!tracks || tracks.length === 0) {
            console.log("Fetching tracks from specified album:", ALBUM_ID);
            tracks = await getAlbumTracks(ALBUM_ID, currentToken);
            console.log(
              "Successfully fetched album tracks:",
              tracks?.length || 0
            );
          }

          if (!tracks || tracks.length === 0) {
            console.log("No tracks found, using mock data");
            console.log("Mock songs available:", mockSongs?.length || 0);
            tracks = mockSongs;
          } else {
            // Debug all tracks and their preview URLs
            console.log("=== TRACK PREVIEW URL DEBUG ===");
            tracks.forEach((track, index) => {
              console.log(
                `Track ${index + 1}: ${track.songTitle} - Preview URL: ${
                  track.previewUrl || "None"
                }`
              );
            });

            // NOTE: Spotify preview URLs are now deprecated
            console.log(
              "Spotify preview URLs are deprecated - we will rely on Deezer for audio playback"
            );

            // IMPORTANT CHANGE: Always try to enrich all tracks with Deezer
            console.log(
              "Enriching all tracks with Deezer preview URLs BEFORE filtering"
            );

            try {
              // Try to enrich all tracks with Deezer preview URLs
              // Take more tracks to increase chances of finding ones with preview URLs
              const tracksToTry = tracks.slice(0, 20); // Increased from 15 to 20 tracks to process
              console.log(
                `Attempting to enrich ${tracksToTry.length} tracks with Deezer`
              );

              // Use enrichTracksWithDeezerPreviews to get Deezer previews
              const deezerEnrichedTracks = await enrichTracksWithDeezerPreviews(
                tracksToTry
              );

              // Filter tracks that now have preview URLs
              const validDeezerTracks = deezerEnrichedTracks.filter(
                (track) => track.previewUrl
              );

              console.log(
                `Found ${validDeezerTracks.length} tracks with Deezer preview URLs out of ${deezerEnrichedTracks.length} processed`
              );

              if (validDeezerTracks.length >= 2) {
                console.log(
                  "Using tracks with Deezer preview URLs as they're available"
                );
                tracks = validDeezerTracks;
                console.log(
                  "Sample enriched track:",
                  JSON.stringify({
                    title: tracks[0].songTitle,
                    preview: tracks[0].previewUrl?.substring(0, 30) + "...",
                    source: "Deezer",
                  })
                );
              } else {
                // If we don't have enough tracks with preview URLs,
                // still use whatever we got from Deezer (even if just 1)
                console.log(
                  "Not enough tracks with Deezer preview URLs, using what we have"
                );
                tracks =
                  validDeezerTracks.length > 0
                    ? validDeezerTracks
                    : deezerEnrichedTracks.slice(0, 10);
              }
            } catch (deezerError) {
              console.error("Error enriching tracks with Deezer:", deezerError);

              // Still use the tracks we have
              console.log("Using available tracks despite Deezer error");
              tracks = tracks.slice(0, 15);
            }

            // This flag helps debug whether tracks are being enriched properly
            const hasPreviewUrls = tracks.some((track) => !!track.previewUrl);
            console.log(
              `Tracks now have preview URLs: ${hasPreviewUrls ? "YES" : "NO"}`
            );
            if (hasPreviewUrls) {
              const previewCount = tracks.filter(
                (track) => !!track.previewUrl
              ).length;
              console.log(
                `${previewCount}/${tracks.length} tracks have preview URLs`
              );
            }

            // Add additional data fields as needed
            tracks = tracks.map((track) => ({
              ...track,
              uri: track.uri || null,
              externalUrl: track.externalUrl || null,
              _debug: {
                title: track.songTitle,
                artists: track.songArtists,
                duration: track.duration,
                albumArt: track.imageUrl ? "Available" : "Unavailable",
                previewUrl: track.previewUrl ? "Available" : "Unavailable",
                source: track.previewUrl ? "Deezer" : "Spotify",
              },
            }));

            console.log(
              "Sample track data:",
              JSON.stringify(tracks[0], null, 2)
            );
          }
        } catch (apiError) {
          console.error("Error fetching from Spotify API:", apiError);
          console.log("Using fallback mock data");
          console.log("Mock songs available:", mockSongs?.length || 0);
          tracks = mockSongs;

          // Handle API errors
          if (apiError?.response?.status === 401) {
            console.log("Authentication error (401)");
            // We don't need to handle token refresh here since getValidToken already did that
            // Just notify the user and use mock data
            Alert.alert(
              "Spotify Authentication Issue",
              "There was a problem with your Spotify authentication. Using sample songs instead.",
              [{ text: "OK" }]
            );
          } else if (apiError?.response?.status === 403) {
            console.log("Authorization error (403): Missing required scope");
            Alert.alert(
              "Permission Error",
              "This app needs permission to access your tracks. Please reconnect to Spotify with all permissions.",
              [{ text: "OK", onPress: () => handleReturnToLobby() }]
            );
          } else if (apiError?.response?.status === 429) {
            console.log("Rate limit reached (429)");
            Alert.alert(
              "Too Many Requests",
              "You've made too many requests to Spotify. Please try again later.",
              [{ text: "OK" }]
            );
          }
        }
      }

      // Final check to make sure we have tracks to use
      if (!tracks || tracks.length === 0) {
        console.error("No tracks available, even after trying mock data!");
        // Create emergency fallback track if all else fails
        tracks = [
          {
            songTitle: "Emergency Fallback Song",
            songArtists: ["Synth App"],
            albumName: "Fallback Album",
            imageUrl: "https://via.placeholder.com/300",
            duration: 30000,
            previewUrl: null, // No audio available for fallback
            uri: null,
            externalUrl: null,
          },
        ];

        setError("Could not load song data. Using emergency fallback.");
      }

      console.log(`Using ${tracks.length} tracks for the game`);
      console.log(
        `Tracks with preview URLs: ${
          tracks.filter((t) => !!t.previewUrl).length
        }/${tracks.length}`
      );

      // Process the tracks for the game
      const processedSongs = tracks.slice(0, 15).map((track) => ({
        ...track,
        // We'll assign players to songs when they are selected for a round, not in advance
      }));

      setAllSongs(processedSongs);
      selectSongForRound(1, processedSongs);
      setIsLoading(false);
      setGameStage("playing");
      setHasFetchedSongs(true);

      // If we're in multiplayer, ensure we're sending tracks with preview URLs to the server
      if (isMultiplayer && emit) {
        const tracksWithPreviews = processedSongs.filter(
          (track) => !!track.previewUrl
        );
        if (tracksWithPreviews.length > 0) {
          console.log(
            `[TRACK_SYNC] Sending ${tracksWithPreviews.length} tracks with preview URLs to server`
          );
          // Only send tracks that have preview URLs to avoid server using mock tracks
          return tracksWithPreviews;
        } else {
          console.warn(
            "[TRACK_SYNC] No tracks with preview URLs to send to server!"
          );
          return processedSongs;
        }
      }

      return processedSongs;
    };

    // Only fetch songs once and after auth is initialized
    fetchSongs();
  }, [token, players, hasFetchedSongs, isInitialized]);

  // Improve Audio resource management
  // Unload audio resources properly when unmounting
  useEffect(() => {
    return () => {
      if (sound) {
        console.log("Cleaning up audio resources");
        try {
          sound
            .unloadAsync()
            .catch((e) => console.log("Error unloading sound", e));
        } catch (err) {
          console.error("Error in audio cleanup:", err);
        }
      }

      // Clear any timeouts
      if (audioLoadTimeoutRef.current) {
        clearTimeout(audioLoadTimeoutRef.current);
      }
    };
  }, [sound]);

  // Simplify the audio status update handler to reduce overhead
  const onPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) return;

    // Only update UI if values are actually changing
    if (playbackPosition !== status.positionMillis) {
      setPlaybackPosition(status.positionMillis);
    }

    if (
      playbackDuration !== status.durationMillis &&
      status.durationMillis > 0
    ) {
      setPlaybackDuration(status.durationMillis);
    }

    // Only update isPlaying if it changed
    if (isPlaying !== status.isPlaying) {
      setIsPlaying(status.isPlaying);
    }

    // Always allow voting
    setVoteProgress(100);
    if (!canVote) {
      setCanVote(true);
    }

    // Handle song completion
    if (status.didJustFinish) {
      setIsPlaying(false);
    }
  };

  // Simplified function for loading and playing audio
  const loadAndPlaySong = async (song) => {
    console.log(
      "[TRACK_SYNC] loadAndPlaySong called for:",
      song?.songTitle || "Unknown"
    );

    if (!song) {
      console.error("[TRACK_SYNC] Attempted to load null or undefined song");
      return;
    }

    // Prevent update loops by checking if we're already playing this exact song with same ID
    if (
      currentSong &&
      currentSong.songTitle === song.songTitle &&
      currentSong.roundTraceId === song.roundTraceId
    ) {
      console.log(
        "[TRACK_SYNC] Already playing this exact song, skipping redundant update"
      );
      return;
    }

    // Ensure we have complete song data
    const enhancedSong = {
      ...song,
      songTitle: song?.songTitle || "Unknown Song",
      songArtists: song?.songArtists || ["Unknown Artist"],
      albumName: song?.albumName || "Unknown Album",
      imageUrl: song?.imageUrl || "https://via.placeholder.com/300",
      duration: song?.duration || 30000,
    };

    // If no assignedToPlayer but we're in a round, try to assign a player
    if (!enhancedSong.assignedToPlayer && currentRound > 0) {
      // Try to find a player assignment
      const roundIndex = (currentRound - 1) % players.length;
      const assignedPlayer = players[roundIndex];
      console.log(
        `[TRACK_SYNC] Auto-assigning song to player ${assignedPlayer.username} based on round`
      );
      enhancedSong.assignedToPlayer = assignedPlayer;
    }

    // Track if we need to notify server to avoid duplicate notifications
    const shouldNotifyServer =
      isMultiplayer &&
      emit &&
      (!currentSong ||
        currentSong.songTitle !== enhancedSong.songTitle ||
        currentSong.roundTraceId !== enhancedSong.roundTraceId);

    // Update current song data in state (do this only once per unique song)
    setCurrentSong(enhancedSong);
    setIsLoadingAudio(true);

    // Notify server about song status for ALL clients (both host and non-host)
    // Only if this is a new/different song
    if (shouldNotifyServer) {
      try {
        emit("song_playing", {
          gameId,
          roundNumber: currentRound,
          songTitle: enhancedSong.songTitle,
          songArtists: enhancedSong.songArtists,
          albumName: enhancedSong.albumName,
          imageUrl: enhancedSong.imageUrl,
          roundTraceId:
            enhancedSong.roundTraceId ||
            `${gameId}-${currentRound}-${Date.now()}`,
          previewUrl: enhancedSong.previewUrl,
          assignedToPlayer: enhancedSong.assignedToPlayer,
        });
      } catch (err) {
        console.error("[TRACK_SYNC] Error notifying server:", err);
      }
    }

    // Non-hosts only need UI updates, not audio
    if (!isHost) {
      console.log("[TRACK_SYNC] Non-host device: updating UI only");
      setIsPlaying(false);
      setPlaybackPosition(0);
      setPlaybackDuration(enhancedSong.duration || 30000);
      setIsLoadingAudio(false);
      setAudioLoadError(null);
      setCanVote(true);
      return;
    }

    // Host device: handle audio playback
    try {
      // Check if song has a preview URL
      if (!enhancedSong.previewUrl) {
        console.log("[TRACK_SYNC] Song has no preview URL, skipping audio");
        setIsLoadingAudio(false);
        setIsPlaying(false);
        setCanVote(true);
        return;
      }

      // Clean up existing sound
      if (sound) {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch (error) {
          console.error(
            "[TRACK_SYNC] Error cleaning up previous sound:",
            error
          );
        }
      }

      // Simple audio load with maximum timeout
      try {
        // Clear any existing timeout
        if (audioLoadTimeoutRef.current) {
          clearTimeout(audioLoadTimeoutRef.current);
        }

        // Set a 20-second timeout for loading
        const timeoutPromise = new Promise((_, reject) => {
          audioLoadTimeoutRef.current = setTimeout(() => {
            reject(new Error("Audio load timed out after 20 seconds"));
          }, 20000);
        });

        // For mobile devices, don't autoplay - let user manually start
        const shouldAutoPlay = Platform.OS !== 'web' || !navigator.userAgent.match(/Mobile|Android|iPhone|iPad/i);
        
        console.log(`[TRACK_SYNC] Loading audio with autoplay: ${shouldAutoPlay}`);

        // Load the audio (with or without autoplay based on platform)
        const { sound: newSound } = await Promise.race([
          Audio.Sound.createAsync(
            { uri: enhancedSong.previewUrl },
            { shouldPlay: shouldAutoPlay },
            onPlaybackStatusUpdate
          ),
          timeoutPromise,
        ]);

        // Clear timeout on success
        clearTimeout(audioLoadTimeoutRef.current);

        // Update state
        setSound(newSound);
        setIsPlaying(shouldAutoPlay);
        setIsLoadingAudio(false);
        setCanVote(true);
        
        if (shouldAutoPlay) {
          console.log("[TRACK_SYNC] Successfully loaded and started audio");
        } else {
          console.log("[TRACK_SYNC] Successfully loaded audio (manual play required on mobile)");
        }
      } catch (error) {
        console.error("[TRACK_SYNC] Error loading audio:", error.message);
        clearTimeout(audioLoadTimeoutRef.current);
        setIsLoadingAudio(false);
        setCanVote(true);
      }
    } catch (error) {
      console.error("[TRACK_SYNC] Unexpected error:", error);
      setIsLoadingAudio(false);
      setCanVote(true);
    }
  };

  // Make voting more reliable by ensuring it's always enabled
  // Add this additional effect to ensure voting is enabled
  useEffect(() => {
    if (gameStage === "playing" && !canVote) {
      console.log("Force enabling vote button");
      setCanVote(true);
      setVoteProgress(100);
    }
  }, [gameStage, currentSong]);

  // Toggle play/pause function with simplified error handling
  const togglePlayPause = async () => {
    if (!isHost) {
      console.log("[TRACK_SYNC] Non-host device cannot control playback");
      Alert.alert(
        "Host Playback Only",
        "Audio playback is controlled by the host device.",
        [{ text: "OK" }]
      );
      return;
    }

    if (!sound) return;

    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error("Error toggling playback:", error);
      // Try to recover from error
      if (sound) {
        try {
          // Attempt to reset the sound
          await sound.stopAsync();
          setTimeout(() => {
            sound
              .playAsync()
              .catch((e) => console.error("Recovery failed:", e));
          }, 500);
        } catch (e) {
          console.error("Error in recovery attempt:", e);
        }
      }
    }
  };

  // Simplify the next round function to reduce network load
  const handleNextRound = async () => {
    // Reset voting visual state
    setSelectedPlayer(null);
    setShowVoteResult(false);
    setCanVote(false);

    // Reset vote tracking state
    setPendingVotes({});
    setAllVotesCast(false);

    // Stop current playback
    if (sound) {
      try {
        console.log("Stopping current sound playback");
        await sound.stopAsync();
      } catch (error) {
        console.error("Error stopping sound:", error);
      }
    }

    // Clear audio error state
    setAudioLoadError(null);

    // For multiplayer games, request next round from server (host only)
    if (isMultiplayer) {
      if (isHost) {
        console.log(`Requesting next round for game ${gameId}`);

        // IMPORTANT: Don't reset played songs in multiplayer mode
        // Let the server handle song selection

        // Request server to advance to next round with minimal data
        sendNextRound(gameId);
      } else {
        console.log("Waiting for host to advance to next round");
      }
      return;
    }

    // Single player mode handling
    const nextRound = currentRound + 1;
    setCurrentRound(nextRound);

    if (nextRound > maxRounds) {
      console.log("Game completed, showing results");
      setGameStage("results");
      return;
    }

    // Select a song for this round
    selectSongForRound(nextRound);
  };

  // Simplified selectSongForRound function (restored but optimized)
  const selectSongForRound = (round, songs = allSongs) => {
    if (!songs || songs.length === 0) return;

    console.log("Selecting song for round", round);

    // Filter out songs that have already been played
    const availableSongs = songs.filter(
      (song) =>
        !playedSongs.some((played) => played.songTitle === song.songTitle)
    );

    // If we've played all songs, reset tracking
    if (availableSongs.length === 0) {
      console.log("All songs have been played, resetting tracking");
      setPlayedSongs([]);

      // Use a random song as fallback
      const randomSong = songs[Math.floor(Math.random() * songs.length)];
      const randomPlayer = players[Math.floor(Math.random() * players.length)];

      const songWithPlayer = {
        ...randomSong,
        assignedToPlayer: randomPlayer,
      };

      setRoundSongs((prev) => ({
        ...prev,
        [round]: songWithPlayer,
      }));

      loadAndPlaySong(songWithPlayer);
      return;
    }

    // Select a random song and player
    const randomIndex = Math.floor(Math.random() * availableSongs.length);
    const selectedSong = availableSongs[randomIndex];
    const randomPlayerIndex = Math.floor(Math.random() * players.length);
    const assignedPlayer = players[randomPlayerIndex];

    const songWithAssignment = {
      ...selectedSong,
      assignedToPlayer: assignedPlayer,
    };

    // Update state
    setRoundSongs((prev) => ({
      ...prev,
      [round]: songWithAssignment,
    }));

    setPlayedSongs((prev) => [...prev, songWithAssignment]);
    loadAndPlaySong(songWithAssignment);
  };

  // Set up WebSocket event listeners for multiplayer
  useEffect(() => {
    if (!isMultiplayer || !isConnected) return;

    console.log(
      "[TRACK_SYNC] Setting up WebSocket event listeners for multiplayer game"
    );

    // Handle playlist shared event
    const playlistSharedCleanup = on(EVENTS.PLAYLIST_SHARED, (data) => {
      if (data.gameId !== gameId) return;

      console.log(
        `[TRACK_SYNC] Received consolidated playlist with ${data.playlist.length} tracks`
      );

      // Update maxRounds from server if provided
      if (data.maxRounds) {
        console.log(
          `[TRACK_SYNC] Server configured for ${data.maxRounds} rounds`
        );
        setMaxRounds(data.maxRounds);
      }

      // Count the number of mock tracks
      const mockTracks = data.playlist.filter(
        (item) =>
          item.track.songTitle === "Bohemian Rhapsody" ||
          item.track.songTitle === "Don't Stop Believin'" ||
          item.track.songTitle === "Billie Jean"
      );

      if (mockTracks.length > 0) {
        console.warn(
          `[TRACK_SYNC] WARNING: Received ${mockTracks.length} mock tracks from server!`
        );
        console.warn(
          `[TRACK_SYNC] This is happening because the server couldn't find any tracks with preview URLs`
        );
        console.warn(
          `[TRACK_SYNC] Try enriching tracks with Deezer before sending to server`
        );
      }

      // Log all tracks for debugging purposes
      console.log("[TRACK_SYNC] Available tracks in playlist:");
      data.playlist.forEach((item, index) => {
        const isMock = item.track.isMockTrack ? "[MOCK]" : "[USER]";
        console.log(
          `[TRACK_SYNC] ${index + 1}. ${isMock} "${item.track.songTitle}" by ${
            Array.isArray(item.track.songArtists)
              ? item.track.songArtists.join(", ")
              : item.track.songArtists
          }`
        );
        console.log(
          `[TRACK_SYNC]    Owner: ${item.owner.username}, Preview URL: ${
            item.track.previewUrl ? "Available" : "Missing"
          }`
        );
      });

      // Store the consolidated playlist
      setConsolidatedPlaylist(data.playlist);

      // Update allSongs with just the track data
      const extractedSongs = data.playlist.map((item) => ({
        ...item.track,
        assignedToPlayer: {
          username: item.owner.username,
          id: item.owner.id,
        },
      }));

      setAllSongs(extractedSongs);

      // Force loading to complete if needed
      if (isLoading) {
        setIsLoading(false);
        setGameStage("playing");
      }
    });

    // Handle round started event (server sends song to play)
    const roundStartedCleanup = on(EVENTS.ROUND_STARTED, (data) => {
      console.log(
        "[TRACK_SYNC] Round started event received",
        data.roundNumber
      );

      if (data.gameId !== gameId) {
        return;
      }

      // Force loading to complete
      if (isLoading) {
        setIsLoading(false);
      }

      // Check for maxRounds data
      if (data.maxRounds) {
        console.log(
          `[TRACK_SYNC] Server indicated max rounds: ${data.maxRounds}`
        );
        setMaxRounds(data.maxRounds);
      }

      setCurrentRound(data.roundNumber);
      setGameStage("playing");

      // Reset vote tracking for new round
      console.log(
        `[TRACK_SYNC] Resetting vote tracking for round ${data.roundNumber}`
      );
      setPendingVotes({});
      setAllVotesCast(false);

      // Set up the song for this round
      if (data.song) {
        // Make sure we have all the required data with fallbacks
        const songData = {
          ...data.song,
          songTitle: data.song.songTitle || "Unknown Song",
          songArtists: Array.isArray(data.song.songArtists)
            ? data.song.songArtists
            : data.song.songArtists
            ? [data.song.songArtists]
            : ["Unknown Artist"],
          albumName: data.song.albumName || "Unknown Album",
          imageUrl: data.song.imageUrl || "https://via.placeholder.com/300",
          previewUrl: data.song.previewUrl,
          roundTraceId:
            data.roundTraceId ||
            data.song.roundTraceId ||
            `game-${gameId}-round-${data.roundNumber}`,
          assignedToPlayer:
            data.song.assignedToPlayer ||
            data.assignedToPlayer ||
            data.assignedPlayer,
        };

        // Log the song data we're using
        console.log(
          "[TRACK_SYNC] Round started with song:",
          JSON.stringify({
            title: songData.songTitle,
            artists: Array.isArray(songData.songArtists)
              ? songData.songArtists.join(", ")
              : songData.songArtists,
            albumName: songData.albumName,
            hasPreviewUrl: !!songData.previewUrl,
            hasImage: !!songData.imageUrl,
            assignedPlayer: songData.assignedToPlayer?.username || "unknown",
          })
        );

        // Update state and load song (which will respect the host-only settings)
        setCurrentSong(songData);
        setRoundSongs((prev) => ({
          ...prev,
          [data.roundNumber]: songData,
        }));

        // Force can vote to be true
        setCanVote(true);
        setVoteProgress(100);

        loadAndPlaySong(songData);
      } else {
        console.error("[TRACK_SYNC] Round started without song data");
      }
    });

    // Update the vote result and player voted handlers

    // Improve the player voted handler to better handle player IDs
    const playerVotedCleanup = on(EVENTS.PLAYER_VOTED, (data) => {
      if (data.gameId !== gameId) return;

      // Extract player information
      const votedPlayerId = data.player?.id;
      const votedPlayerUsername = data.player?.username;

      console.log(`[TRACK_SYNC] Player voted event:`, data);
      console.log(
        `[TRACK_SYNC] Player ${votedPlayerUsername} (ID: ${votedPlayerId}) voted for round ${data.round}`
      );

      // Ensure we're tracking for the current round
      if (data.round !== currentRound) {
        console.log(
          `[TRACK_SYNC] Ignoring vote for round ${data.round}, we're on round ${currentRound}`
        );
        return;
      }

      // Track who has voted
      setPendingVotes((prev) => {
        const newPendingVotes = {
          ...prev,
          [votedPlayerId]: true,
        };

        if (votedPlayerUsername) {
          // Also track by username for redundancy
          newPendingVotes[votedPlayerUsername] = true;
        }

        // Check if this completes all votes
        const votedCount = Object.keys(newPendingVotes).filter(
          (key) =>
            // Filter out username entries to avoid double counting
            !players.some((p) => p?.username === key)
        ).length;

        const totalPlayers = players.filter((p) => p !== undefined).length;

        // Log vote progress
        console.log(
          `[TRACK_SYNC] Vote progress: ${votedCount}/${totalPlayers} votes received for round ${currentRound}`
        );

        if (votedCount >= totalPlayers) {
          console.log(
            `[TRACK_SYNC] All votes received for round ${currentRound}!`
          );
          setAllVotesCast(true);
        }

        return newPendingVotes;
      });
    });

    // Handle vote results - critical for round progression
    const voteResultCleanup = on(EVENTS.VOTE_RESULT, (data) => {
      if (data.gameId !== gameId) return;

      console.log("[TRACK_SYNC] Vote result received:", data);

      // Reset voting tracking state for the next round
      setPendingVotes({});
      setAllVotesCast(false);

      // Update scores with improved handling - prioritize scoresWithUsernames
      if (data.scoresWithUsernames) {
        // Server provided username-mapped scores - use directly
        console.log("[TRACK_SYNC] Using scoresWithUsernames from server:", data.scoresWithUsernames);
        processPlayerPointsUpdate(data.scoresWithUsernames);
      } else if (data.scores) {
        // Fallback to manual mapping if scoresWithUsernames not available
        console.log("[TRACK_SYNC] Manually mapping scores from server:", data.scores);
        processPlayerPointsUpdate(data.scores);
      }

      // Update track assignments
      if (data.votes) {
        setTrackAssignments(data.votes);
      }

      // Now show the vote result
      setShowVoteResult(true);

      // Check if this is the last round
      const isLastRound = data.isLastRound || currentRound >= maxRounds;

      // After a delay, transition to the leaderboard stage
      setTimeout(() => {
        console.log(
          "[TRACK_SYNC] Transitioning to leaderboard after vote results"
        );
        setGameStage("leaderboard");

        // If this is the last round, transition to results after leaderboard
        if (isLastRound) {
          console.log(
            "[TRACK_SYNC] This was the final round, preparing for game end"
          );
        }
      }, 2500);
    });

    // Handle force song sync event (emergency sync)
    const forceSyncCleanup = on(EVENTS.FORCE_SONG_SYNC, (data) => {
      if (data.gameId !== gameId) return;

      const traceId = data.roundTraceId || data.song?.roundTraceId;
      const now = Date.now();

      // Update maxRounds if provided
      if (data.maxRounds) {
        console.log(
          `[TRACK_SYNC] Server indicated max rounds: ${data.maxRounds}`
        );
        setMaxRounds(data.maxRounds);
      }

      // Add moderate throttling - reduce from 3 seconds to 1 second
      // This allows faster synchronization while still avoiding spam
      const SYNC_THROTTLE_MS = 1000; // Reduced from 3000ms to 1000ms

      if (now - lastSyncTimestamp.current < SYNC_THROTTLE_MS) {
        console.log(
          "[TRACK_SYNC] Ignoring force sync due to throttling - too soon since last sync"
        );
        return;
      }

      // If we already processed this exact trace ID recently, ignore it
      if (lastSyncTraceIds.current.includes(traceId)) {
        console.log(
          `[TRACK_SYNC] Already processed sync with trace ID ${traceId}, ignoring duplicate`
        );
        return;
      }

      // Skip if we're already playing this exact song title and it has the same trace ID
      if (
        currentSong &&
        data.song &&
        currentSong.songTitle === data.song.songTitle &&
        currentSong.roundTraceId === traceId
      ) {
        console.log(
          "[TRACK_SYNC] Already playing this song with matching trace ID, ignoring force sync"
        );
        return;
      }

      console.log(
        "[TRACK_SYNC] Force sync received for round",
        data.roundNumber,
        "song:",
        data.song?.songTitle
      );

      // Update the timestamp of our last processed sync
      lastSyncTimestamp.current = now;

      // Track this trace ID to avoid processing duplicates
      lastSyncTraceIds.current.push(traceId);
      // Keep only the most recent trace IDs
      if (lastSyncTraceIds.current.length > MAX_SYNC_HISTORY) {
        lastSyncTraceIds.current.shift();
      }

      // First, validate that we have song data
      if (!data.song) {
        console.error("[TRACK_SYNC] Received force sync without song data");
        return;
      }

      // Update the current round
      setCurrentRound(data.roundNumber);

      // Handle scores if provided in force sync
      if (data.scoresWithUsernames) {
        console.log("[TRACK_SYNC] Force sync includes scoresWithUsernames:", data.scoresWithUsernames);
        processPlayerPointsUpdate(data.scoresWithUsernames);
      } else if (data.scores) {
        console.log("[TRACK_SYNC] Force sync includes raw scores:", data.scores);
        processPlayerPointsUpdate(data.scores);
      }

      // Normalize song data with complete fields
      const syncSong = {
        ...data.song,
        songTitle: data.song.songTitle || "Unknown Song",
        songArtists: data.song.songArtists || ["Unknown Artist"],
        albumName: data.song.albumName || "Unknown Album",
        imageUrl: data.song.imageUrl || "https://via.placeholder.com/300",
        roundTraceId: traceId,
        assignedToPlayer: data.song.assignedToPlayer || data.assignedPlayer,
      };

      // Update all relevant state AT ONCE to avoid cascading updates
      // This helps prevent the maximum update depth exceeded error
      console.log(
        `[TRACK_SYNC] Applying force sync for "${syncSong.songTitle}"`
      );

      // Update state directly rather than calling loadAndPlaySong to avoid loops
      setCurrentSong(syncSong);
      setRoundSongs((prev) => ({
        ...prev,
        [data.roundNumber]: syncSong,
      }));

      // Make sure we can vote
      setVoteProgress(100);
      setCanVote(true);

      // Now load and play the audio for the sync song
      if (isHost) {
        if (!syncSong.previewUrl) {
          console.log(
            "[TRACK_SYNC] Force sync song has no preview URL, skipping audio"
          );
          setIsLoadingAudio(false);
          setIsPlaying(false);
        } else {
          // Load audio separately rather than triggering another full loadAndPlaySong
          console.log("[TRACK_SYNC] Loading audio for force synced song");
          setIsLoadingAudio(true);

          // Clean up existing sound
          if (sound) {
            sound
              .stopAsync()
              .catch((e) => console.error("Error stopping sound:", e));
            sound
              .unloadAsync()
              .catch((e) => console.error("Error unloading sound:", e));
          }

          // For mobile devices, don't autoplay - let user manually start
          const shouldAutoPlay = Platform.OS !== 'web' || !navigator.userAgent.match(/Mobile|Android|iPhone|iPad/i);
          
          console.log(`[TRACK_SYNC] Loading force sync audio with autoplay: ${shouldAutoPlay}`);

          // Load the audio directly
          Audio.Sound.createAsync(
            { uri: syncSong.previewUrl },
            { shouldPlay: shouldAutoPlay },
            onPlaybackStatusUpdate
          )
            .then(({ sound: newSound }) => {
              setSound(newSound);
              setIsPlaying(shouldAutoPlay);
              setIsLoadingAudio(false);
              
              if (shouldAutoPlay) {
                console.log("[TRACK_SYNC] Successfully loaded and started force sync audio");
              } else {
                console.log("[TRACK_SYNC] Successfully loaded force sync audio (manual play required on mobile)");
              }
            })
            .catch((error) => {
              console.error(
                "[TRACK_SYNC] Error loading audio for synced song:",
                error
              );
              setIsLoadingAudio(false);
            });
        }
      } else {
        // Non-host only needs UI updates
        setIsPlaying(false);
        setPlaybackPosition(0);
        setPlaybackDuration(syncSong.duration || 30000);
        setIsLoadingAudio(false);
      }

      // After applying sync, notify server that we're now playing this song
      // This helps the server confirm that sync was successful
      if (emit) {
        setTimeout(() => {
          try {
            emit("song_playing", {
              gameId,
              roundNumber: data.roundNumber,
              songTitle: syncSong.songTitle,
              songArtists: syncSong.songArtists,
              albumName: syncSong.albumName,
              imageUrl: syncSong.imageUrl,
              roundTraceId: traceId,
              previewUrl: syncSong.previewUrl,
              assignedToPlayer: syncSong.assignedToPlayer,
            });
            console.log("[TRACK_SYNC] Confirmed synchronized song to server");
          } catch (err) {
            console.error("[TRACK_SYNC] Error confirming sync to server:", err);
          }
        }, 500); // Small delay to avoid immediate re-sync
      }
    });

    // Add new handlers for the improved sync events

    // Handle song receipts from clients
    const songReceivedCleanup = on(EVENTS.SONG_RECEIVED, (data) => {
      if (data.gameId !== gameId) return;

      console.log(
        `[TRACK_SYNC] Client ${data.deviceRole} received song for round ${data.roundNumber}`
      );
    });

    // Handle host playback status updates
    const hostPlaybackCleanup = on(EVENTS.HOST_PLAYBACK_STATUS, (data) => {
      if (data.gameId !== gameId || isHost) return; // Only non-host devices listen to this

      if (!data.canPlayAudio) {
        console.log(
          `[TRACK_SYNC] Host cannot play audio for song: ${data.songTitle}`
        );
      }
    });

    // Handle sync status update from server
    const syncStatusCleanup = on(EVENTS.SYNC_STATUS, (data) => {
      if (data.gameId !== gameId) return;

      console.log(
        `[TRACK_SYNC] Game sync status: ${data.status}, round ${data.roundNumber}`
      );

      // If server reports any sync issues, update UI
      if (data.status === "out_of_sync") {
        console.log(
          `[TRACK_SYNC] Game is out of sync! ${data.syncedClients}/${data.totalClients} clients in sync`
        );
      }
    });

    // Legacy event handler - some servers might still use this
    const songPlayingCleanup = on(EVENTS.SONG_PLAYING, (data) => {
      if (data.gameId !== gameId) return;

      console.log(`[TRACK_SYNC] Client is playing song: ${data.songTitle}`);

      // Add more detailed debug logging for song data synchronization
      console.log(`[TRACK_SYNC] Song data received from other client:`, {
        title: data.songTitle || "Unknown",
        artists: data.songArtists || "Unknown",
        album: data.albumName || "Unknown",
        hasImage: !!data.imageUrl,
        imageUrl: data.imageUrl
          ? data.imageUrl.substring(0, 30) + "..."
          : "None",
        roundTraceId: data.roundTraceId || "None",
      });

      // If this is another client's data, check if our song data matches
      if (currentSong && data.songTitle !== currentSong.songTitle) {
        console.log(`[TRACK_SYNC] Song mismatch detected!`);
        console.log(
          `[TRACK_SYNC] Our song: "${currentSong.songTitle}", Their song: "${data.songTitle}"`
        );
      } else if (currentSong) {
        console.log(`[TRACK_SYNC] Songs are synchronized between clients`);
      }
    });

    // Cleanup all event listeners on unmount
    return () => {
      playlistSharedCleanup();
      roundStartedCleanup();
      voteResultCleanup();
      playerVotedCleanup();
      forceSyncCleanup();
      songReceivedCleanup();
      hostPlaybackCleanup();
      syncStatusCleanup();
      songPlayingCleanup();
    };
  }, [isMultiplayer, isConnected, gameId, isHost]);

  const handleReturnToLobby = () => {
    // Pass the original game parameters back to the lobby
    router.replace({
      pathname: "/game-lobby",
      params: {
        gameName,
        playerCount,
        players: JSON.stringify(players.map((p) => p.username)),
        returningFromGame: true, // Flag to indicate returning from a game
        gameId: gameId, // Preserve the game ID for continuity
        isMultiplayer: isMultiplayer.toString(), // Pass the multiplayer flag
      },
    });
  };

  const handleTokenError = async (error) => {
    console.log("Token error:", error);

    if (error?.response?.status === 401) {
      try {
        // Try to automatically refresh the token
        console.log("Attempting to refresh expired token");
        const newToken = await getValidToken();

        if (newToken) {
          // Successfully refreshed, continue with the game
          console.log("Token refreshed successfully");
          Alert.alert(
            "Spotify Connection Refreshed",
            "Your Spotify connection has been refreshed. You can continue playing.",
            [{ text: "Continue" }]
          );
          return;
        } else {
          // Failed to refresh automatically, prompt for manual authentication
          Alert.alert(
            "Spotify Session Expired",
            "Your Spotify session has expired. Would you like to reconnect?",
            [
              {
                text: "Cancel",
                onPress: () => handleReturnToLobby(),
                style: "cancel",
              },
              {
                text: "Reconnect",
                onPress: async () => {
                  await logout();
                  await getSpotifyAuth();
                  Alert.alert(
                    "Authentication Started",
                    "Please complete the authentication in the browser. Return to the lobby when finished.",
                    [{ text: "OK", onPress: () => handleReturnToLobby() }]
                  );
                },
              },
            ]
          );
        }
      } catch (refreshError) {
        console.error("Error refreshing token:", refreshError);
        // Show manual re-authentication dialog
        Alert.alert(
          "Authentication Failed",
          "There was a problem refreshing your Spotify session. Would you like to reconnect manually?",
          [
            {
              text: "Cancel",
              onPress: () => handleReturnToLobby(),
              style: "cancel",
            },
            {
              text: "Reconnect",
              onPress: async () => {
                await logout();
                await getSpotifyAuth();
                Alert.alert(
                  "Authentication Started",
                  "Please complete the authentication in the browser. Return to the lobby when finished.",
                  [{ text: "OK", onPress: () => handleReturnToLobby() }]
                );
              },
            },
          ]
        );
      }
    } else {
      // Some other error
      Alert.alert(
        "Spotify Connection Error",
        "There was a problem connecting to Spotify. Please try again later.",
        [{ text: "OK", onPress: () => handleReturnToLobby() }]
      );
    }
  };

  // Add a useEffect hook that watches playbackPosition to enable voting after MIN_PLAY_DURATION
  useEffect(() => {
    // If we have a valid playback position that exceeds MIN_PLAY_DURATION, enable voting
    if (playbackPosition >= MIN_PLAY_DURATION && !canVote && currentSong) {
      console.log(`Enabling voting at position ${playbackPosition}ms`);
      setCanVote(true);
    }
  }, [playbackPosition, canVote, currentSong]);

  // Helper function to get the profile photo based on username or player object
  const getProfilePhotoForUser = (playerOrUsername) => {
    // If it's a player object with a Spotify profile picture, use that
    if (playerOrUsername?.profilePicture) {
      return { uri: playerOrUsername.profilePicture };
    }

    // If it's a string (username), use the local avatar
    const username =
      typeof playerOrUsername === "string"
        ? playerOrUsername
        : playerOrUsername?.username;
    if (username) {
      // Remove @ symbol if present
      const name = username.replace("@", "");

      // Map usernames to their profile photos
      switch (name) {
        case "luke_mcfall":
          return require("../assets/photos/lukepfp.png");
        case "cole_sprout":
          return require("../assets/photos/colepfp.png");
        case "maya_avital":
          return require("../assets/photos/mayapfp.png");
        case "marcus_lintott":
          return require("../assets/photos/marcuspfp.png");
        default:
          return require("../assets/pfp.png"); // Default fallback
      }
    }

    // Fallback to default profile picture
    return require("../assets/pfp.png");
  };

  // Add a useEffect hook to persist playedSongs in AsyncStorage
  useEffect(() => {
    // Load previously played songs from storage when component mounts
    const loadPlayedSongs = async () => {
      try {
        const storedPlayedSongs = await AsyncStorage.getItem("playedSongs");
        if (storedPlayedSongs) {
          const parsedSongs = JSON.parse(storedPlayedSongs);
          console.log(
            `Loaded ${parsedSongs.length} previously played songs from storage`
          );
          setPlayedSongs(parsedSongs);
        }
      } catch (error) {
        console.error("Error loading played songs from storage:", error);
      }
    };

    loadPlayedSongs();
  }, []);

  // Save played songs to storage whenever the list changes
  useEffect(() => {
    if (playedSongs.length > 0) {
      const savePlayedSongs = async () => {
        try {
          await AsyncStorage.setItem(
            "playedSongs",
            JSON.stringify(playedSongs)
          );
          console.log(`Saved ${playedSongs.length} played songs to storage`);
        } catch (error) {
          console.error("Error saving played songs to storage:", error);
        }
      };

      savePlayedSongs();
    }
  }, [playedSongs]);

  // Update handlePlayAgain to reset vote selection state as well
  const handlePlayAgain = () => {
    // Reset voting visual state
    setSelectedPlayer(null);
    setShowVoteResult(false);

    // Reset the game state
    setCurrentRound(1);
    setGameStage("loading");
    setPlayerSongs({});
    setRoundSongs({});

    // Stop any playing audio
    if (sound) {
      sound.stopAsync();
      sound.unloadAsync();
      setSound(null);
    }

    // Reset audio playback state
    setIsPlaying(false);
    setPlaybackPosition(0);
    setPlaybackDuration(0);
    setCanVote(false);

    // Use router.push instead of replace to ensure component fully remounts
    router.push({
      pathname: "/game-play",
      params: {
        gameName,
        playerCount,
        gameId,
        players: JSON.stringify(players.map((p) => p.username)),
        timestamp: Date.now(), // Add timestamp to force a refresh
      },
    });
  };

  // Add state for round history tracking
  const [roundHistory, setRoundHistory] = useState([]);

  // Add a loading timeout to prevent getting stuck on loading screen
  useEffect(() => {
    if (isLoading) {
      console.log(
        "Loading timeout started - will auto-advance in 5 seconds if still loading"
      );
      const loadingTimeout = setTimeout(() => {
        if (isLoading) {
          console.log(
            "Loading timeout triggered - auto-advancing past loading screen"
          );
          setIsLoading(false);
          setGameStage("playing");

          // Check if we already have received songs from the server
          if (allSongs.length === 0 && consolidatedPlaylist.length > 0) {
            // Extract songs from the consolidated playlist
            const extractedSongs = consolidatedPlaylist.map((item) => ({
              ...item.track,
              assignedToPlayer: {
                username: item.owner.username,
                id: item.owner.id,
              },
            }));
            setAllSongs(extractedSongs);
          }

          // If we still have no songs, use mock songs
          if (allSongs.length === 0) {
            console.log("No songs loaded, using mock songs");
            setAllSongs(mockSongs);
          }

          // Check if we already have a current song
          if (!currentSong && allSongs.length > 0) {
            console.log("Setting a current song since none is loaded");
            setCurrentSong(allSongs[0]);
          }
        }
      }, 5000); // Reduced from 10000 to 5000 (5 seconds)

      return () => clearTimeout(loadingTimeout);
    }
  }, [isLoading, allSongs, consolidatedPlaylist, mockSongs]);

  // Add an additional timeout for the host specifically
  useEffect(() => {
    if (isHost && isLoading) {
      console.log(
        "[HOST] Special host loading check - will verify in 3 seconds"
      );
      const hostLoadingTimeout = setTimeout(() => {
        console.log("[HOST] Checking if host is still loading...");
        if (isLoading) {
          console.log(
            "[HOST] Host device still loading - attempting to force progress"
          );

          // Force loading to complete
          setIsLoading(false);
          setGameStage("playing");

          // If we have no allSongs but have consolidatedPlaylist, use it
          if (allSongs.length === 0 && consolidatedPlaylist.length > 0) {
            console.log("[HOST] Using consolidated playlist for songs");
            const extractedSongs = consolidatedPlaylist.map((item) => ({
              ...item.track,
              assignedToPlayer: {
                username: item.owner.username,
                id: item.owner.id,
              },
            }));
            setAllSongs(extractedSongs);
          } else if (allSongs.length === 0) {
            console.log("[HOST] No songs found, using mock songs for host");
            setAllSongs(mockSongs);
          }

          // Make sure we have a current song
          if (!currentSong && allSongs.length > 0) {
            const firstSong = allSongs[0];
            console.log(`[HOST] Setting first song: ${firstSong.songTitle}`);
            setCurrentSong(firstSong);
            loadAndPlaySong(firstSong);
          }
        }
      }, 3000); // Check after 3 seconds

      return () => clearTimeout(hostLoadingTimeout);
    }
  }, [
    isHost,
    isLoading,
    allSongs,
    consolidatedPlaylist,
    mockSongs,
    currentSong,
  ]);

  // At the top of the component where other refs are defined, add:
  const loadedSongRef = useRef(null);

  // Auto-play song when game becomes active and we have a current song
  useEffect(() => {
    if (
      gameStage === "playing" &&
      currentSong &&
      !isPlaying &&
      !isLoadingAudio
    ) {
      // Track if we've already tried to load this exact song to prevent loops
      const songKey = `${currentSong.songTitle}-${
        currentSong.roundTraceId || ""
      }`;
      if (loadedSongRef.current === songKey) {
        console.log(
          "[TRACK_SYNC] Already attempted to load this song, preventing loop"
        );
        return;
      }

      console.log(
        "[TRACK_SYNC] Auto-playing current song:",
        currentSong.songTitle
      );
      loadedSongRef.current = songKey;
      loadAndPlaySong(currentSong);
    }
  }, [gameStage, currentSong, isPlaying, isLoadingAudio]);

  // Add a new handler for timeout from leaderboard
  const handleLeaderboardTimeout = () => {
    console.log("Leaderboard timeout, advancing to next round or results");
    // This should work similar to handleNextRound but always progress to the next song
    setGameStage("playing");

    if (currentRound >= maxRounds) {
      setGameStage("results");
      return;
    }

    if (isMultiplayer && isHost) {
      sendNextRound(gameId);
    } else if (!isMultiplayer) {
      // For single player, just select the next song
      selectSongForRound(currentRound + 1);
    }
  };

  // Add debugging for player data structure
  useEffect(() => {
    if (isMultiplayer && players.length > 0) {
      console.log("[TRACK_SYNC] Player structure debug:");
      console.log("First player object:", JSON.stringify(players[0]));
      console.log("second player object:", JSON.stringify(players[1]));
      console.log(
        "Player IDs:",
        players.map((p) => `${p.id} (${typeof p.id})`).join(", ")
      );
      console.log(
        "Player usernames:",
        players.map((p) => p.username).join(", ")
      );
    }
  }, [isMultiplayer, players]);

  // After players are updated, log their structure for debugging
  useEffect(() => {
    if (players.length > 0 && isMultiplayer) {
      console.log("[TRACK_SYNC] Player structure debug:");
      console.log("First player object:", players[0]);
      console.log("Player IDs:", players.map((p) => p.id).join(", "));
      console.log(
        "Player usernames:",
        players.map((p) => p.username).join(", ")
      );
    }
  }, [players, isMultiplayer]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#C143FF" />
            <Text style={styles.loadingText}>Loading songs...</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
            <Text style={styles.errorText}>{error}</Text>

            <View style={styles.buttonsContainer}>
              <Pressable
                style={styles.returnButton}
                onPress={handleReturnToLobby}
              >
                <Text style={styles.returnButtonText}>Back to Lobby</Text>
              </Pressable>
              <Pressable style={styles.playAgainButton} onPress={handlePlayAgain}>
                <Text style={styles.playAgainButtonText}>Try Again</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.gameStatusBar}>
        <Text style={styles.roundText}>
          Round {currentRound} of {maxRounds}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {currentSong && gameStage === "playing" && (
          <View style={styles.songPlaybackContainer}>
            <View style={styles.albumArtworkWrapper}>
              <View style={styles.albumArtworkBackground}>
                <Image
                  source={{ uri: currentSong.imageUrl }}
                  style={styles.albumCover}
                  resizeMode="cover"
                />
              </View>
            </View>

            <View style={styles.songPlaybackInfo}>
              <View style={{ maxHeight: "2em" }}>
                <Text style={styles.playbackSongTitle} numberOfLines={1}>
                  {currentSong.songTitle}
                </Text>
              </View>
              <View style={{ maxHeight: "2em" }}>
                <Text style={styles.playbackArtistName} numberOfLines={1}>
                  {currentSong.songArtists.join(", ")}
                </Text>
              </View>
            </View>

            <View style={styles.playbackControlsContainer}>
              {isLoadingAudio ? (
                <View style={styles.loadingAudioContainer}>
                  <ActivityIndicator size="small" color="#C143FF" />
                  <Text style={styles.loadingAudioText}>Loading audio...</Text>
                </View>
              ) : audioLoadError ? (
                <View style={styles.audioErrorContainer}>
                  <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
                  <Text style={styles.errorText}>{audioLoadError}</Text>

                  <View style={styles.buttonsContainer}>
                    <Pressable
                      style={styles.returnButton}
                      onPress={handleReturnToLobby}
                    >
                      <Text style={styles.returnButtonText}>Back to Lobby</Text>
                    </Pressable>
                    <Pressable
                      style={styles.playAgainButton}
                      onPress={handlePlayAgain}
                    >
                      <Text style={styles.playAgainButtonText}>Try Again</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.progressContainer}>
                    <Text style={styles.timeText}>
                      {formatTime(playbackPosition)}
                    </Text>
                    {Platform.OS === 'web' ? (
                      <View style={styles.progressBar}>
                        <View style={styles.progressTrack}>
                          <View 
                            style={[
                              styles.progressFill,
                              {
                                width: `${
                                  playbackDuration > 0 
                                    ? Math.min(100, (playbackPosition / playbackDuration) * 100)
                                    : 0
                                }%`
                              }
                            ]}
                          />
                          <View 
                            style={[
                              styles.progressThumb,
                              {
                                left: `${
                                  playbackDuration > 0 
                                    ? Math.min(100, (playbackPosition / playbackDuration) * 100)
                                    : 0
                                }%`
                              }
                            ]}
                          />
                        </View>
                      </View>
                    ) : (
                      <Slider
                        style={styles.progressBar}
                        minimumValue={0}
                        maximumValue={
                          playbackDuration > 0 ? playbackDuration : 30000
                        }
                        value={playbackPosition}
                        minimumTrackTintColor="#C143FF"
                        maximumTrackTintColor="#444"
                        thumbTintColor="#FFC857"
                        disabled={true}
                      />
                    )}
                    <Text style={styles.timeText}>
                      {formatTime(playbackDuration)}
                    </Text>
                  </View>

                  <View style={styles.controlButtonsContainer}>
                    <TouchableOpacity
                      style={styles.playPauseButton}
                      onPress={togglePlayPause}
                    >
                      <Ionicons
                        name={isPlaying ? "pause" : "play"}
                        size={32}
                        color="white"
                      />
                    </TouchableOpacity>
                    
                    {/* Show manual play prompt for mobile when audio is loaded but not playing */}
                    {!isPlaying && sound && Platform.OS === 'web' && navigator.userAgent.match(/Mobile|Android|iPhone|iPad/i) && (
                      <Text style={styles.mobilePlayPrompt}>
                        Tap play to start audio
                      </Text>
                    )}
                  </View>

                  {currentSong?.externalUrl && (
                    <TouchableOpacity
                      style={[
                        styles.externalLinkButton,
                        styles.spotifyLinkButton,
                      ]}
                      onPress={async () => {
                        // try {
                        //   // Log the Spotify link click event with relevant parameters
                        //   await logEvent(analytics, "spotify_link_click", {
                        //     song_title: currentSong.songTitle,
                        //     song_artists: Array.isArray(currentSong.songArtists)
                        //       ? currentSong.songArtists.join(", ")
                        //       : currentSong.songArtists,
                        //     round_number: currentRound,
                        //     game_id: gameId,
                        //   });

                        //   // Open the Spotify URL
                        //   await Linking.openURL(currentSong.externalUrl);
                        // } catch (error) {
                        //   console.error(
                        //     "Error logging Spotify link click:",
                        //     error
                        //   );
                        // Still try to open the URL even if logging fails
                        await Linking.openURL(currentSong.externalUrl);
                        //}
                      }}
                    >
                      <Image
                        source={require("../assets/white-spotify-logo.png")}
                        style={{ width: 20, height: 20, marginRight: 5 }}
                      />
                      <Text style={styles.externalLinkText}>Open in Spotify</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            <View style={styles.voteButtonContainer}>
              <TouchableOpacity
                activeOpacity={canVote ? 0.7 : 1}
                onPress={() => {
                  if (canVote) {
                    // Make sure we have an assigned player before going to voting stage
                    if (!currentSong?.assignedToPlayer) {
                      // Just in case it wasn't assigned, pick a random player now
                      const randomPlayer =
                        players[Math.floor(Math.random() * players.length)];
                      console.log(
                        `Assigning song ${currentSong.songTitle} to player ${randomPlayer.username} during vote`
                      );
                      setCurrentSong({
                        ...currentSong,
                        assignedToPlayer: randomPlayer,
                      });
                      // Update in roundSongs state too
                      setRoundSongs((prev) => ({
                        ...prev,
                        [currentRound]: {
                          ...prev[currentRound],
                          assignedToPlayer: randomPlayer,
                        },
                      }));
                    }
                    setGameStage("voting");
                  } else {
                    Alert.alert(
                      "Not Ready Yet",
                      `Please listen to at least ${
                        MIN_PLAY_DURATION / 1000
                      } seconds of the song before voting.`,
                      [{ text: "OK" }]
                    );
                  }
                }}
              >
                <View style={styles.voteButtonWrapper}>
                  {/* Progress bar background */}
                  <View style={styles.voteProgressBackground}>
                    {/* Progress bar fill that grows based on playback position */}
                    <View
                      style={[
                        styles.voteProgressFill,
                        { width: `${voteProgress}%` },
                        canVote ? styles.voteProgressComplete : {},
                      ]}
                    />
                  </View>

                  {/* Button content */}
                  <View
                    style={[
                      styles.voteButtonContent,
                      !canVote
                        ? styles.voteButtonDisabled
                        : styles.voteButtonEnabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.voteButtonText,
                        !canVote ? styles.voteButtonTextDisabled : {},
                      ]}
                    >
                      VOTE NOW
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={24}
                      color={canVote ? "black" : "#777"}
                    />
                  </View>
                </View>
              </TouchableOpacity>

              {/* <Text style={styles.voteHintText}>
                {canVote
                  ? "Make your guess about who listened to this song"
                  : `Listen for ${
                      MIN_PLAY_DURATION / 1000
                    } seconds before voting...`}
              </Text> */}
            </View>
          </View>
        )}

        {gameStage === "voting" && (
          <VotingStage
            players={players}
            currentSong={currentSong}
            currentRound={currentRound}
            selectedPlayer={selectedPlayer}
            showVoteResult={showVoteResult}
            setSelectedPlayer={setSelectedPlayer}
            setShowVoteResult={setShowVoteResult}
            setPlayerSongs={setPlayerSongs}
            setPlayerPoints={setPlayerPoints}
            nextRound={handleNextRound}
            getProfilePhotoForUser={getProfilePhotoForUser}
            isMultiplayer={isMultiplayer}
            gameId={gameId}
            playerPoints={playerPoints}
            castVote={castVote}
            allVotesCast={allVotesCast}
          />
        )}

        {gameStage === "leaderboard" && (
          <LeaderboardScreen
            currentSong={currentSong}
            assignedUser={currentSong?.assignedToPlayer}
            currentRound={currentRound}
            players={players}
            playerPoints={playerPoints}
            getProfilePhotoForUser={getProfilePhotoForUser}
            onTimeout={handleLeaderboardTimeout}
          />
        )}

        {gameStage === "results" && (
          <ResultsStage
            players={players}
            playerPoints={playerPoints}
            roundSongs={roundSongs}
            getProfilePhotoForUser={getProfilePhotoForUser}
            handleReturnToLobby={handleReturnToLobby}
            handlePlayAgain={handlePlayAgain}
            currentRound={currentRound}
            isMultiplayer={isMultiplayer}
            trackAssignments={trackAssignments}
            styles={styles}
          />
        )}
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
  },
  headerTitle: {
    color: "#FFC857",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    bottom: 10,
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
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 0,
    shadowColor: "#8E44AD",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  albumCover: {
    width: 300,
    height: 300,
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
    maxHeight: "2em",
  },
  playbackArtistName: {
    color: "#CCC",
    fontSize: 18,
    marginTop: 8,
    textAlign: "center",
    maxHeight: "1.5em",
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
  spotifyPromptContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
  },
  spotifyPromptText: {
    color: "white",
    fontSize: 16,
    marginBottom: 15,
    textAlign: "center",
  },
  spotifyButton: {
    backgroundColor: "#1DB954",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginVertical: 10,
  },
  spotifyButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
  noLinkText: {
    color: "#999",
    fontSize: 14,
    fontStyle: "italic",
  },
  voteButtonContainer: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: "center",
  },
  voteButtonWrapper: {
    width: "100%",
    alignItems: "center",
    position: "relative",
  },
  voteProgressBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "100%",
    backgroundColor: "transparent",
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 0,
    borderColor: "#555",
  },
  voteProgressFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    borderWidth: 0,
    backgroundColor: "transparent", // Darker shade for incomplete
    transition: "width 0.3s",
  },
  voteProgressComplete: {
    backgroundColor: "transparent", // Purple for complete
    borderWidth: 0,
  },
  voteButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: "80%",
    borderRadius: 30,
    zIndex: 1, // Ensure content is above the progress bar
  },
  voteButtonDisabled: {
    backgroundColor: "#7D7575",
    borderColor: "#555",
    opacity: 0.8,
  },
  voteButtonEnabled: {
    backgroundColor: "#FFC857",
    borderColor: "#E6A100",
    shadowColor: "#FFC857",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 5,
  },
  voteButtonText: {
    color: "#000",
    fontSize: 22,
    fontWeight: "bold",
    marginRight: 8,
  },
  voteButtonTextDisabled: {
    color: "#000",
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
    borderWidth: 2,
    borderColor: "#444",
  },
  correctVoteButton: {
    backgroundColor: "rgba(75, 181, 67, 0.2)",
    borderColor: "#4BB543",
    shadowColor: "#4BB543",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 5,
  },
  incorrectVoteButton: {
    backgroundColor: "rgba(255, 107, 107, 0.2)",
    borderColor: "#FF6B6B",
    shadowColor: "#FF6B6B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 5,
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
    padding: 20,
    alignItems: "center",
    width: "100%",
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
    backgroundColor: "#333",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  returnButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  externalLinkButton: {
    padding: 10,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    alignSelf: "center",
    backgroundColor: "#1DB954",
  },
  spotifyLinkButton: {
    backgroundColor: "#1DB954",
  },
  externalLinkText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 5,
  },
  spotifyEmbedContainer: {
    width: "100%",
    height: 80,
    marginBottom: 10,
    borderRadius: 10,
    overflow: "hidden",
  },
  playerToggleContainer: {
    alignItems: "center",
    marginVertical: 10,
  },
  playerToggleButton: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  playerToggleText: {
    color: "white",
    fontSize: 12,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 10,
  },
  progressBar: {
    flex: 1,
    height: 40,
    marginHorizontal: 10,
  },
  timeText: {
    color: "#AAA",
    fontSize: 12,
  },
  controlButtonsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#C143FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0,
    shadowColor: "#C143FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 10,
    // borderColor: "#FFC857",
  },
  loadingAudioContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingAudioText: {
    color: "white",
    marginTop: 10,
    fontSize: 14,
  },
  audioErrorContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  audioErrorText: {
    color: "#FF6B6B",
    marginBottom: 15,
    fontSize: 14,
    textAlign: "center",
  },
  countdownContainer: {
    width: "80%",
    marginTop: 10,
    marginBottom: 5,
  },
  countdownTrack: {
    height: 4,
    backgroundColor: "#444",
    borderRadius: 2,
    overflow: "hidden",
  },
  countdownProgress: {
    height: "100%",
    backgroundColor: "#C143FF",
  },
  reviewListContainer: {
    width: "100%",
    backgroundColor: "#232323",
    borderRadius: 16,
    padding: 16,
    marginBottom: 30,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  reviewListTitle: {
    color: "#FFC857",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  reviewListItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#282828",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  reviewSongImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#444",
  },
  reviewSongInfo: {
    flex: 1,
    justifyContent: "center",
  },
  reviewSongTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  reviewSongArtist: {
    color: "#AAA",
    fontSize: 14,
  },
  reviewPlayerInfo: {
    alignItems: "center",
    marginLeft: 10,
  },
  reviewPlayerAvatarWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
    overflow: "hidden",
  },
  reviewPlayerAvatar: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  reviewPlayerName: {
    color: "#FFC857",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginTop: 20,
  },
  playAgainButton: {
    backgroundColor: "#8E44AD",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  playAgainButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  scoresContainer: {
    width: "100%",
    backgroundColor: "#232323",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  scoresTitle: {
    color: "#FFC857",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  scoresList: {
    width: "100%",
  },
  scoreItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#282828",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#444",
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
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  scoreValue: {
    color: "#FFC857",
    fontSize: 18,
    fontWeight: "bold",
  },
  resultsScrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  debugPanelContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#232323",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#444",
  },
  debugPanelHeader: {
    backgroundColor: "#333",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  debugPanelTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  debugPanelContent: {
    padding: 10,
  },
  debugText: {
    color: "white",
    fontSize: 16,
    marginBottom: 10,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "#444",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#C143FF",
  },
  progressThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFC857",
    position: "absolute",
    top: -6, // Center vertically on the 4px track
    marginLeft: -8, // Center horizontally on the position
  },
  mobilePlayPrompt: {
    color: "white",
    fontSize: 12,
    marginTop: 10,
    textAlign: "center",
    opacity: 0.8,
  },
});
