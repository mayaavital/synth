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
} from "../utils/deezerApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWebSocket, EVENTS } from "../utils/useWebSocket";

const ALBUM_ID = "2noRn2Aes5aoNVsU6iWThc";
const ROUNDS_TOTAL = 3;
const MIN_PLAY_DURATION = 15000; // Set to 15 seconds as specified

// Format time helper function
const formatTime = (milliseconds) => {
  if (!milliseconds) return "0:00";
  
  let totalSeconds = Math.floor(milliseconds / 1000);
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = totalSeconds % 60;
  
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

// Define styles outside the component
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
  headerTitleContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    bottom: 10,
  },
  headerTitle: {
    color: "#FFC857",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  menuButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  placeholder: {
    width: 44,
  },
  connectionStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
  },
  connectionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  connectionActive: {
    backgroundColor: "#4BB543",
  },
  connectionInactive: {
    backgroundColor: "#FF6B6B",
  },
  connectionStatusText: {
    color: "white",
    fontSize: 14,
    marginRight: 8,
  },
  reconnectButton: {
    backgroundColor: "#8E44AD",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  reconnectButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
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
  infoText: {
    color: "white",
    fontSize: 16,
    marginTop: 10,
  },
  content: {
    flex: 1,
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
  albumArtwork: {
    width: 250,
    height: 250,
    borderRadius: 10,
  },
  audioControlsContainer: {
    marginTop: 20,
  },
  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 15,
  },
  progressBar: {
    flex: 1,
    height: 40,
  },
  durationLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  durationText: {
    color: "#AAA",
    fontSize: 12,
  },
  playButtonContainer: {
    alignItems: "center",
    marginVertical: 15,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#44C568",
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonDisabled: {
    opacity: 0.5,
  },
  audioErrorText: {
    color: "#FF6B6B",
    textAlign: "center",
    marginTop: 10,
  },
  countdownText: {
    color: "white",
    textAlign: "center",
    marginTop: 10,
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
  votingContainer: {
    flex: 1,
    padding: 20,
  },
  votingInstructions: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
  },
  playersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  playerVoteButton: {
    width: "48%",
    height: 100,
    borderRadius: 10,
    backgroundColor: "#333",
    margin: "1%",
    justifyContent: "center",
    alignItems: "center",
  },
  correctVoteButton: {
    backgroundColor: "#4BB543",
  },
  incorrectVoteButton: {
    backgroundColor: "#FF6B6B",
  },
  profileImageContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
    overflow: "hidden",
  },
  profileBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  playerVoteName: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  resultsScrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  resultsContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  resultsTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  gameStats: {
    backgroundColor: "#282828",
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
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
  scoresContainer: {
    backgroundColor: "#282828",
    padding: 20,
    borderRadius: 10,
  },
  scoresTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  scoresList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  scoreItem: {
    width: "48%",
    margin: "1%",
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
  },
  scoreValue: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  reviewListContainer: {
    flex: 1,
  },
  reviewListTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  reviewListItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  reviewSongImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 10,
  },
  reviewSongInfo: {
    flex: 1,
  },
  reviewSongTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  reviewSongArtist: {
    color: "white",
    fontSize: 14,
  },
  reviewPlayerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewPlayerAvatarWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    marginRight: 10,
  },
  reviewPlayerAvatar: {
    width: "100%",
    height: "100%",
  },
  reviewPlayerName: {
    color: "white",
    fontSize: 16,
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  returnButton: {
    backgroundColor: "#8E44AD",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  returnButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  playAgainButton: {
    backgroundColor: "#4BB543",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  playAgainButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  songPlaybackInfo: {
    alignItems: "center",
    marginTop: 10,
  },
  playbackSongTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  playbackArtistName: {
    color: "white",
    fontSize: 16,
  },
  voteButtonContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  voteButtonWrapper: {
    backgroundColor: "#333",
    borderRadius: 20,
    padding: 10,
    width: "80%",
  },
  voteProgressBackground: {
    backgroundColor: "#777",
    borderRadius: 10,
    height: 20,
    marginBottom: 10,
  },
  voteProgressFill: {
    backgroundColor: "#FFC857",
    borderRadius: 10,
    height: 20,
  },
  voteButtonContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  voteButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  voteButtonDisabled: {
    opacity: 0.5,
  },
  voteButtonEnabled: {
    opacity: 1,
  },
  voteButtonTextDisabled: {
    color: "#777",
  },
  voteProgressComplete: {
    backgroundColor: "#4BB543",
  },
});

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

  // Replace the existing hook initialization
  // Add websocket hook at the component level
  const { 
    castVote, 
    nextRound: requestNextRound, 
    selectSong, 
    on,
    isConnected,
    socket,
    connect
  } = useWebSocket();

  // Add a useEffect to ensure proper WebSocket connection
  useEffect(() => {
    // Only attempt to connect if this is a multiplayer game and connection isn't already established
    if (isMultiplayer && !isConnected && !socket) {
      console.log("Initializing WebSocket connection for multiplayer game...");
      // Connect immediately without waiting
      connect();
    }
  }, [isMultiplayer, isConnected, socket, connect]);

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
  const [gameStage, setGameStage] = useState("loading"); // loading, playing, voting, results
  const [error, setError] = useState(null);
  const [playerSongs, setPlayerSongs] = useState({});
  const [hasFetchedSongs, setHasFetchedSongs] = useState(false);

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

  // Track points awarded for @cole_sprout (and add state for tracking this)
  const [playerPoints, setPlayerPoints] = useState({
    "@cole_sprout": 0,
  });

  // Add a state variable to track the voting progress percentage
  const [voteProgress, setVoteProgress] = useState(0);

  // Get game details from params
  const gameName = params.gameName || "Game Name";
  const playerCount = parseInt(params.playerCount) || 4;
  const gameId = params.gameId || `${Date.now().toString(36).substr(-4).toUpperCase()}`;
  const isMultiplayer = params.isMultiplayer === "true";
  const isHost = params.isHost === "true";

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
  const players =
    playerUsernames.length > 0
      ? playerUsernames.map((username, index) => ({
          id: index + 1,
          username,
          platform: "spotify",
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

            // Filter out tracks without valid preview URLs
            const validTracks = tracks.filter((track) => {
              const hasValidPreview =
                track.previewUrl && track.previewUrl.trim() !== "";
              if (!hasValidPreview) {
                console.log(
                  `Track filtered out (no preview URL): ${track.songTitle}`
                );
              }
              return hasValidPreview;
            });
            console.log(
              `Found ${validTracks.length}/${tracks.length} tracks with preview URLs`
            );

            if (validTracks.length < 3) {
              console.log(
                "Not enough tracks with preview URLs, trying individual track API..."
              );

              // Try fetching individual tracks to see if we can get preview URLs
              const individualTracks = [];
              const trackPromises = [];

              // Try to get more tracks than we need in case some fail
              const maxTracksToTry = 10;
              const tracksToTry = tracks.slice(0, maxTracksToTry);

              // Use Promise.all with a timeout to avoid waiting too long
              const fetchWithTimeout = async (trackId) => {
                try {
                  return await Promise.race([
                    getTrackDetails(trackId, currentToken),
                    new Promise((_, reject) =>
                      setTimeout(() => reject(new Error("Timeout")), 5000)
                    ),
                  ]);
                } catch (e) {
                  console.log(`Fetch timed out or failed for track ${trackId}`);
                  return null;
                }
              };

              for (const track of tracksToTry) {
                if (track.trackId) {
                  trackPromises.push(fetchWithTimeout(track.trackId));
                }
              }

              try {
                const results = await Promise.all(trackPromises);
                for (const trackDetails of results) {
                  if (trackDetails && trackDetails.previewUrl) {
                    console.log(
                      `Found preview URL for track ${trackDetails.songTitle}`
                    );
                    individualTracks.push(trackDetails);
                  }
                }
              } catch (batchError) {
                console.error("Error in batch track fetching:", batchError);
              }

              // If we still don't have at least 3 valid tracks with preview URLs, try Deezer
              const combinedTracks = [...validTracks, ...individualTracks];
              if (combinedTracks.length < 3) {
                console.log(
                  "Not enough preview URLs from Spotify, trying Deezer API"
                );

                try {
                  // Try to enrich tracks with Deezer preview URLs
                  const deezerEnrichedTracks =
                    await enrichTracksWithDeezerPreviews(tracksToTry);

                  // Filter tracks that now have preview URLs
                  const validDeezerTracks = deezerEnrichedTracks.filter(
                    (track) => track.previewUrl
                  );
                  console.log(
                    `Found ${validDeezerTracks.length} tracks with Deezer preview URLs`
                  );

                  if (validDeezerTracks.length >= 3) {
                    console.log("Using Deezer preview URLs");
                    tracks = validDeezerTracks;
                  } else {
                    // Combine all tracks with valid preview URLs
                    const allValidTracks = [
                      ...combinedTracks,
                      ...validDeezerTracks,
                    ];
                    if (allValidTracks.length >= 3) {
                      console.log(
                        `Using combined ${allValidTracks.length} tracks with preview URLs from Spotify and Deezer`
                      );
                      tracks = allValidTracks;
                    } else {
                      console.log(
                        "Still not enough preview URLs, falling back to mock data"
                      );
                      tracks = mockSongs;
                    }
                  }
                } catch (deezerError) {
                  console.error(
                    "Error enriching tracks with Deezer:",
                    deezerError
                  );

                  if (combinedTracks.length >= 3) {
                    tracks = combinedTracks;
                  } else {
                    console.log("Using mock songs after Deezer error");
                    tracks = mockSongs;
                  }
                }
              } else {
                // Use the combined tracks if we have enough
                tracks = combinedTracks;
              }
            } else {
              tracks = validTracks;
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
    };

    // Only fetch songs once and after auth is initialized
    fetchSongs();
  }, [token, players, hasFetchedSongs, isInitialized]);

  // Cleanup audio resources when unmounting
  useEffect(() => {
    return () => {
      if (sound) {
        sound
          .unloadAsync()
          .catch((e) => console.log("Error unloading sound", e));
      }

      if (audioLoadTimeoutRef.current) {
        clearTimeout(audioLoadTimeoutRef.current);
      }
    };
  }, [sound]);

  // Audio status update handler
  const onPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) return;

    setPlaybackPosition(status.positionMillis);
    setPlaybackDuration(status.durationMillis);

    // Set play/pause state based on audio status
    setIsPlaying(status.isPlaying);

    // Calculate vote progress as a percentage (0-100)
    const progress = Math.min(100, (status.positionMillis / MIN_PLAY_DURATION) * 100);
    setVoteProgress(progress);

    // Enable voting after at least 15 seconds
    console.log(
      `Playback position: ${status.positionMillis}, MIN_PLAY_DURATION: ${MIN_PLAY_DURATION}, canVote: ${canVote}`
    );
    if (status.positionMillis >= MIN_PLAY_DURATION && !canVote) {
      console.log("Enabling vote button");
      setCanVote(true);
    }

    // Handle song completion
    if (status.didJustFinish) {
      setIsPlaying(false);
    }
  };

  // Update loadAndPlaySong function to handle Deezer icons
  const loadAndPlaySong = async (song) => {
    console.log("Loading song:", song?.songTitle);
    console.log("Preview URL:", song?.previewUrl);
    console.log("Full song object:", JSON.stringify(song, null, 2).substring(0, 300) + "...");

    // Verify we have a valid song object
    if (!song) {
      console.error("No song provided to loadAndPlaySong");
      setAudioLoadError("No song data available");
      setIsLoadingAudio(false);
      return;
    }

    // Set current song for display regardless of audio playback success
    setCurrentSong(song);
    setIsLoadingAudio(true);
    setAudioLoadError(null);

    // Explicitly reset voting state for the new song
    setCanVote(false);
    setPlaybackPosition(0);
    setPlaybackDuration(0);

    // Unload any existing sound first to avoid conflicts
    if (sound) {
      try {
        await sound.unloadAsync();
        console.log("Previous sound unloaded successfully");
      } catch (error) {
        console.error("Error unloading previous sound:", error);
      }
      setSound(null);
    }

    // Check if we have a valid preview URL
    if (!song.previewUrl) {
      console.log(
        "No preview URL available for this song, trying Deezer as last resort"
      );

      try {
        // Try to find this track on Deezer as a last attempt
        const deezerTrack = await findDeezerTrackFromSpotify(song);
        if (deezerTrack && deezerTrack.previewUrl) {
          console.log("Found Deezer preview URL for:", song.songTitle);
          console.log("Deezer preview URL:", deezerTrack.previewUrl);
          
          // Update the current song with the Deezer preview URL
          song = {
            ...song,
            previewUrl: deezerTrack.previewUrl,
            deezerInfo: {
              trackId: deezerTrack.trackId,
              externalUrl: deezerTrack.externalUrl,
            },
          };
          setCurrentSong(song);
        } else {
          console.log("No Deezer preview URL found either");
          setAudioLoadError("No preview available for this song");
          setIsLoadingAudio(false);

          // Enable voting even without audio
          setTimeout(() => {
            setCanVote(true);
          }, 5000);
          return;
        }
      } catch (deezerError) {
        console.error("Error finding Deezer preview:", deezerError);
        setAudioLoadError("No preview available for this song");
        setIsLoadingAudio(false);

        // Enable voting even without audio
        setTimeout(() => {
          setCanVote(true);
        }, 5000);
        return;
      }
    }

    try {
      // Set timeout to handle case where audio loading takes too long
      if (audioLoadTimeoutRef.current) {
        clearTimeout(audioLoadTimeoutRef.current);
      }

      audioLoadTimeoutRef.current = setTimeout(() => {
        setIsLoadingAudio(false);
        setAudioLoadError("Audio loading timed out. You can still vote.");
        setCanVote(true);
      }, 15000);

      console.log("Creating new sound object for:", song.previewUrl);
      
      // Create a new sound object - in multiplayer mode, always autoplay
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: song.previewUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 100 },
        onPlaybackStatusUpdate
      );

      console.log("Sound created successfully, starting playback");
      setSound(newSound);
      setIsPlaying(true);
      setIsLoadingAudio(false);

      // Clear the timeout if audio loaded successfully
      clearTimeout(audioLoadTimeoutRef.current);
      audioLoadTimeoutRef.current = null;

      console.log("Audio loaded and playing successfully");
      
      // Make a test play to verify audio works
      try {
        await newSound.setPositionAsync(0);
        await newSound.playAsync();
        console.log("Audio playback test successful");
      } catch (playError) {
        console.error("Error testing audio playback:", playError);
      }
    } catch (error) {
      console.error("Error loading audio:", error);
      console.error("Error details:", JSON.stringify(error));
      setIsLoadingAudio(false);
      setAudioLoadError("Error loading audio. You can still vote.");
      setCanVote(true);

      // Clear the timeout if we've already handled the error
      if (audioLoadTimeoutRef.current) {
        clearTimeout(audioLoadTimeoutRef.current);
        audioLoadTimeoutRef.current = null;
      }
      
      // Try loading the audio again after a short delay (retry once)
      setTimeout(async () => {
        console.log("Retrying audio playback...");
        try {
          const { sound: retrySound } = await Audio.Sound.createAsync(
            { uri: song.previewUrl },
            { shouldPlay: true, progressUpdateIntervalMillis: 100 },
            onPlaybackStatusUpdate
          );
          
          setSound(retrySound);
          setIsPlaying(true);
          setAudioLoadError(null);
          console.log("Retry successful!");
        } catch (retryError) {
          console.error("Retry also failed:", retryError);
          // Still allow voting even though audio failed
          setCanVote(true);
        }
      }, 2000);
    }
  };

  // Toggle play/pause function - only usable in single player mode
  const togglePlayPause = async () => {
    // In multiplayer mode, don't allow manual play/pause
    if (isMultiplayer) {
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
    }
  };

  // Update selectSongForRound function to handle multiplayer correctly
  const selectSongForRound = (round, songs = allSongs) => {
    if (!songs || songs.length === 0) return;

    console.log("Selecting song for round", round);
    
    // In multiplayer mode, only the host should select songs
    if (isMultiplayer) {
      if (isHost) {
        console.log("Host will select song in multiplayer mode");
        // Let the multiplayer event handlers handle this
        // The song selection will happen in the round_started event handler
      } else {
        console.log("Client waiting for host to select song");
      }
      return;
    }
    
    // Single player mode - continue with existing logic
    console.log("Already played songs:", playedSongs.map(s => s.songTitle));
    
    // Filter out songs that have already been played
    const availableSongs = songs.filter(song => 
      !playedSongs.some(played => played.songTitle === song.songTitle)
    );
    
    console.log("Available songs:", availableSongs.length);
    
    // If we've played all songs, reset the played songs tracking
    if (availableSongs.length === 0) {
      console.log("All songs have been played, resetting tracking");
      setPlayedSongs([]);
      loadAndPlaySong(songs[Math.floor(Math.random() * songs.length)]);
      return;
    }
    
    // Select a random song from available songs
    const randomIndex = Math.floor(Math.random() * availableSongs.length);
    const selectedSong = availableSongs[randomIndex];
    
    // Assign the song to a random player
    const assignedPlayer = players[Math.floor(Math.random() * players.length)];
    const songWithAssignment = {
      ...selectedSong,
      assignedToPlayer: assignedPlayer,
    };
    
    // Track this song for the current round
    setRoundSongs(prev => ({
      ...prev,
      [round]: songWithAssignment
    }));
    
    // Add to played songs list to avoid repeating
    setPlayedSongs(prev => [...prev, songWithAssignment]);
    
    // Load the selected song
    loadAndPlaySong(songWithAssignment);
  };

  // Update nextRound function to reset vote selection state
  const nextRound = async () => {
    // Reset voting visual state
    setSelectedPlayer(null);
    setShowVoteResult(false);
    
    // Stop current playback
    if (sound) {
      try {
        await sound.stopAsync();
      } catch (error) {
        console.error("Error stopping sound:", error);
      }
    }

    // Reset playback-related states
    setPlaybackPosition(0);
    setPlaybackDuration(0);
    setCanVote(false); // Make sure voting is disabled for the new round
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
      
      // Calculate player scores
      const playerScores = {};
      
      // Count correct votes for each player
      Object.entries(playerSongs).forEach(([playerName, votes]) => {
        playerScores[playerName] = votes.filter(vote => vote.isCorrect).length;
      });
      
      console.log("Final scores:", playerScores);
    }
  };

  const handleReturnToLobby = () => {
    // For multiplayer games, return to the multiplayer game lobby to maintain connection
    if (isMultiplayer) {
      console.log("Returning to multiplayer lobby with gameId:", gameId);
      // Navigate back to the multiplayer game component with the original game ID
      router.replace({
        pathname: "/multiplayer-game",
        params: {
          returningFromGame: "true",
          gameId: gameId,
          gameName: gameName,
          playerCount: playerCount
        }
      });
    } else {
      // For single-player games, use the existing behavior
      router.replace({
        pathname: "/game-lobby",
        params: {
          gameName,
          playerCount,
          players: JSON.stringify(players.map(p => p.username)),
          returningFromGame: true, // Flag to indicate returning from a game
          gameId: gameId // Preserve the game ID for continuity
        }
      });
    }
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

  // Helper function to get the profile photo based on username
  const getProfilePhotoForUser = (username) => {
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
  };

  // Add a useEffect hook to persist playedSongs in AsyncStorage
  useEffect(() => {
    // Load previously played songs from storage when component mounts
    const loadPlayedSongs = async () => {
      try {
        const storedPlayedSongs = await AsyncStorage.getItem('playedSongs');
        if (storedPlayedSongs) {
          const parsedSongs = JSON.parse(storedPlayedSongs);
          console.log(`Loaded ${parsedSongs.length} previously played songs from storage`);
          setPlayedSongs(parsedSongs);
        }
      } catch (error) {
        console.error('Error loading played songs from storage:', error);
      }
    };
    
    loadPlayedSongs();
  }, []);

  // Save played songs to storage whenever the list changes
  useEffect(() => {
    if (playedSongs.length > 0) {
      const savePlayedSongs = async () => {
        try {
          await AsyncStorage.setItem('playedSongs', JSON.stringify(playedSongs));
          console.log(`Saved ${playedSongs.length} played songs to storage`);
        } catch (error) {
          console.error('Error saving played songs to storage:', error);
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
        players: JSON.stringify(players.map(p => p.username)),
        timestamp: Date.now(), // Add timestamp to force a refresh
      }
    });
  };

  // Replace the socketSelectSong function to improve error handling and debugging
  const socketSelectSong = useCallback((gameId, round) => {
    console.log(`Host selecting song for round ${round}`);
    
    if (!allSongs || allSongs.length === 0) {
      console.error("No songs available for selection!");
      return false;
    }
    
    // Select a random song from available songs
    let availableSongs = allSongs.filter(song => 
      song.previewUrl && !playedSongs.some(played => played.songTitle === song.songTitle)
    );
    
    console.log(`Found ${availableSongs.length} available songs with preview URLs`);
    
    if (availableSongs.length === 0) {
      console.log("No available songs with preview URLs, using all songs with preview URLs");
      availableSongs = allSongs.filter(song => song.previewUrl);
      
      if (availableSongs.length === 0) {
        console.error("No songs with preview URLs available!");
        Alert.alert(
          "Error",
          "No songs available for playback. Please try restarting the game.",
          [{ text: "OK" }]
        );
        return false;
      }
    }
    
    // Explicitly log random selection details
    const randomIndex = Math.floor(Math.random() * availableSongs.length);
    const selectedSong = availableSongs[randomIndex];
    const randomPlayerIndex = Math.floor(Math.random() * players.length);
    const assignedPlayer = players[randomPlayerIndex];
    
    console.log(`Selected song "${selectedSong.songTitle}" for round ${round}`);
    console.log(`Preview URL available: ${!!selectedSong.previewUrl}`);
    console.log(`Assigning song to player: ${assignedPlayer.username}`);
    
    // Attempt to select the song with retry logic
    const attemptSelection = (retryCount = 0) => {
      console.log(`Selection attempt ${retryCount + 1} for song: ${selectedSong.songTitle}`);
      
      const success = selectSong(gameId, selectedSong, assignedPlayer);
      
      if (!success && retryCount < 2) {
        console.log(`Selection failed, retrying in ${(retryCount + 1) * 1000}ms...`);
        setTimeout(() => attemptSelection(retryCount + 1), (retryCount + 1) * 1000);
      } else if (!success) {
        console.error("Failed to select song after multiple attempts");
        Alert.alert(
          "Connection Issue",
          "There was a problem selecting a song. Please check your connection and try again.",
          [{ text: "OK" }]
        );
      }
    };
    
    // Start selection attempt with retry logic
    attemptSelection();
    
    return true;
  }, [allSongs, players, playedSongs, selectSong]);

  // Add this useEffect to handle song selection when a round is started
  useEffect(() => {
    if (!isMultiplayer || !isHost || !gameId) return;
    
    console.log(`Host effect - round: ${currentRound}, stage: ${gameStage}, connected: ${isConnected}`);
    
    // If we're the host in a multiplayer game and in playing stage but no song is loaded yet
    if (gameStage === "playing" && currentRound > 0 && !currentSong && isConnected) {
      // Add a small delay to ensure all clients are ready
      const timer = setTimeout(() => {
        console.log("Host selecting song for current round (delayed trigger)");
        socketSelectSong(gameId, currentRound);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isMultiplayer, isHost, gameId, gameStage, currentRound, currentSong, isConnected, socketSelectSong]);

  // Add debug logging for state changes
  useEffect(() => {
    console.log(`GameStage changed: ${gameStage}, Round: ${currentRound}, Connected: ${isConnected}`);
    
    // Debug UI rendering conditions
    if (gameStage === "playing") {
      console.log(`Playing UI should show. currentSong: ${currentSong ? 'available' : 'missing'}`);
    }
  }, [gameStage, currentRound, isConnected, currentSong]);

  // Add socket event handlers for multiplayer synchronization
  useEffect(() => {
    if (!isMultiplayer) return;
    
    console.log("Setting up multiplayer event handlers");
    
    // Song selected event handler - When server broadcasts a song selection
    const songSelectedCleanup = on(EVENTS.SONG_SELECTED, (data) => {
      console.log("Received song_selected event:", data);
      
      // Verify the data has the necessary fields
      if (!data?.song) {
        console.error("Received incomplete song_selected data:", data);
        return;
      }
      
      console.log(`Song received: ${data.song.songTitle}, Preview URL available: ${!!data.song.previewUrl}`);
      console.log(`Song assigned to: ${JSON.stringify(data.assignedPlayer)}`);
      
      // Use the song sent by the server instead of selecting our own
      const songWithAssignment = {
        ...data.song,
        assignedToPlayer: data.assignedPlayer
      };
      
      // Track this song for the current round
      setRoundSongs(prev => ({
        ...prev,
        [data.round]: songWithAssignment
      }));
      
      // Add to played songs list to avoid repeating
      setPlayedSongs(prev => {
        // Avoid duplicates by checking if this song is already in the list
        if (!prev.some(s => s.songTitle === songWithAssignment.songTitle)) {
          return [...prev, songWithAssignment];
        }
        return prev;
      });
      
      // Load the song (with safe stopping of previous audio)
      const safelyLoadSong = async () => {
        try {
          // Stop any currently playing audio
          if (sound) {
            try {
              await sound.stopAsync();
              console.log("Stopped previous sound before loading new song");
            } catch (err) {
              console.error("Error stopping previous sound:", err);
            }
          }
          
          // Now load the new song
          loadAndPlaySong(songWithAssignment);
        } catch (error) {
          console.error("Error during song loading sequence:", error);
          // Still try to load the song as a fallback
          loadAndPlaySong(songWithAssignment);
        }
      };
      
      // Execute the loading sequence
      safelyLoadSong();
    });
    
    // Player voted event - Another player has cast their vote
    const playerVotedCleanup = on(EVENTS.PLAYER_VOTED, (data) => {
      console.log("Player voted:", data);
      // Could add some visual feedback showing which players have voted
    });
    
    // Vote result event - Result of your own vote
    const voteResultCleanup = on(EVENTS.VOTE_RESULT, (data) => {
      console.log("Vote result:", data);
      // This event is sent only to the player who voted
    });
    
    // Round complete event - All players have voted
    const roundCompleteCleanup = on(EVENTS.ROUND_COMPLETE, (data) => {
      console.log("Round complete:", data);
      
      // Show the round results to all players
      Alert.alert(
        "Round Complete",
        `Everyone has voted! ${data.correctPlayer ? `${data.correctPlayer.username} listened to this song.` : ""}`,
        [
          {
            text: "Next Round",
            onPress: () => {
              if (currentRound < ROUNDS_TOTAL) {
                // In multiplayer, only the host can advance to the next round
                if (isHost) {
                  console.log("Host requesting next round");
                  requestNextRound(gameId);
                } else {
                  console.log("Waiting for host to start next round");
                }
              } else {
                setGameStage("results");
              }
            },
          },
        ]
      );
    });
    
    // Round started event - Server has started a new round
    const roundStartedCleanup = on(EVENTS.ROUND_STARTED, (data) => {
      console.log("Round started:", data);
      
      // Update client with new round information
      setCurrentRound(data.round);
      setGameStage("playing");
      setSelectedPlayer(null);
      setShowVoteResult(false);
      setCanVote(false);
      
      // Stop any currently playing audio
      if (sound) {
        try {
          sound.stopAsync().catch(err => console.error("Error stopping sound:", err));
        } catch (error) {
          console.error("Error stopping sound:", error);
        }
      }
    });
    
    // Clean up event listeners
    return () => {
      console.log("Cleaning up multiplayer event handlers");
      songSelectedCleanup && songSelectedCleanup();
      playerVotedCleanup && playerVotedCleanup();
      voteResultCleanup && voteResultCleanup();
      roundCompleteCleanup && roundCompleteCleanup();
      roundStartedCleanup && roundStartedCleanup();
    };
  }, [isMultiplayer, sound, on, isHost, currentRound, gameId, requestNextRound, loadAndPlaySong]);
  
  // Add WebSocket connection monitoring and auto-reconnect system
  useEffect(() => {
    if (!isMultiplayer) return;
    
    // Log connection status for debugging
    console.log(`[GamePlay] WebSocket connection status: ${isConnected ? 'Connected' : 'Disconnected'}`);
    
    // If we're disconnected but in a multiplayer game, try to reconnect
    if (!isConnected && gameId) {
      // Set a timeout to prevent too frequent reconnection attempts
      const reconnectTimeout = setTimeout(() => {
        console.log('[GamePlay] Attempting to reconnect to the multiplayer game...');
        
        // Directly try to reconnect via the connect method
        connect();
        
        // If that fails, navigate back to multiplayer screen as a backup approach
        if (!isConnected) {
          router.replace({
            pathname: "/multiplayer-game",
            params: {
              returningFromGame: "true",
              gameId: gameId,
              gameName: gameName,
              playerCount: playerCount
            }
          });
        }
      }, 5000); // Wait 5 seconds before attempting reconnection
      
      // Clear the timeout if component unmounts or connection is restored
      return () => clearTimeout(reconnectTimeout);
    }
  }, [isConnected, isMultiplayer, gameId, gameName, playerCount, router, connect]);
  
  // Modify the connection status indicator to show reconnecting state
  const renderConnectionStatus = () => {
    if (!isMultiplayer) return null;
    
    return (
      <View style={styles.connectionStatusContainer}>
        <View style={[
          styles.connectionIndicator, 
          isConnected ? styles.connectionActive : styles.connectionInactive
        ]} />
        <Text style={styles.connectionStatusText}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
        {!isConnected && (
          <TouchableOpacity 
            style={styles.reconnectButton}
            onPress={() => {
              // Try direct reconnection first
              connect();
              
              // If that doesn't work, use the router approach
              if (!isConnected) {
                router.replace({
                  pathname: "/multiplayer-game",
                  params: {
                    returningFromGame: "true",
                    gameId: gameId,
                    gameName: gameName,
                    playerCount: playerCount
                  }
                });
              }
            }}
          >
            <Text style={styles.reconnectButtonText}>Reconnect</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Modify the return statement to add debugging info
  return (
    <SafeAreaView style={styles.container}>
      {/* Debugging overlay to show component state */}
      {__DEV__ && (
        <View style={{ 
          position: 'absolute', 
          top: 40, 
          right: 10, 
          backgroundColor: 'rgba(0,0,0,0.7)', 
          padding: 5, 
          zIndex: 9999 
        }}>
          <Text style={{ color: 'white', fontSize: 10 }}>
            Stage: {gameStage}, Round: {currentRound}{'\n'}
            Connected: {isConnected ? 'Yes' : 'No'}{'\n'}
            Song: {currentSong?.songTitle?.substring(0, 15) || 'None'}{'\n'}
            Can Vote: {canVote ? 'Yes' : 'No'}
          </Text>
        </View>
      )}
      
      {renderConnectionStatus()}
      
      <View style={styles.gameStatusBar}>
        <Text style={styles.roundText}>
          Round {currentRound} of {ROUNDS_TOTAL}
        </Text>
      </View>

      {/* Song Playback UI */}
      {gameStage === "playing" && (
        <View style={styles.content}>
          {/* Include a fallback message when currentSong is missing */}
          {!currentSong ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8E44AD" />
              <Text style={styles.loadingText}>Waiting for song...</Text>
            </View>
          ) : (
            <View style={styles.songPlaybackContainer}>
              <View style={styles.albumArtworkWrapper}>
                <Image
                  source={{ uri: currentSong.imageUrl }}
                  style={styles.albumArtwork}
                />
              </View>

              {/* Song info section */}
              <View style={styles.songPlaybackInfo}>
                <Text style={styles.playbackSongTitle}>
                  {currentSong.songTitle}
                </Text>
                <Text style={styles.playbackArtistName}>
                  {currentSong.songArtists.join(", ")}
                </Text>
              </View>

              {/* Audio controls */}
              <View style={styles.audioControlsContainer}>
                {/* Audio progress bar */}
                <View style={styles.progressBarContainer}>
                  <Slider
                    style={styles.progressBar}
                    minimumValue={0}
                    maximumValue={
                      playbackDuration > 0 ? playbackDuration : 30000
                    }
                    value={playbackPosition}
                    minimumTrackTintColor="#C143FF"
                    maximumTrackTintColor="#333"
                    thumbTintColor="#FFC857"
                    disabled={true}
                  />
                  <View style={styles.durationLabels}>
                    <Text style={styles.durationText}>
                      {formatTime(playbackPosition)}
                    </Text>
                    <Text style={styles.durationText}>
                      {formatTime(Math.min(playbackDuration, 30000))}
                    </Text>
                  </View>
                </View>

                {/* Audio load error message */}
                {audioLoadError && (
                  <Text style={styles.audioErrorText}>
                    Error loading audio. {audioLoadError}
                  </Text>
                )}

                {/* Countdown to voting */}
                {!canVote && !audioLoadError && (
                  <Text style={styles.countdownText}>
                    {`Listen now! Voting enabled after ${Math.ceil(
                      (MIN_PLAY_DURATION - playbackPosition) / 1000
                    )} seconds...`}
                  </Text>
                )}
              </View>

              {/* Vote button section */}
              <View style={styles.voteButtonContainer}>
                <TouchableOpacity
                  activeOpacity={canVote ? 0.7 : 1}
                  onPress={() => {
                    if (canVote) {
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
                          canVote ? styles.voteProgressComplete : {}
                        ]} 
                      />
                    </View>
                    
                    {/* Button content */}
                    <View style={[
                      styles.voteButtonContent,
                      !canVote ? styles.voteButtonDisabled : styles.voteButtonEnabled,
                    ]}>
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
              </View>
            </View>
          )}
        </View>
      )}
      
      {/* Rest of the UI remains the same */}
      {gameStage === "voting" && (
        <View style={styles.votingContainer}>
          <Text style={styles.votingInstructions}>
            Who do you think listened to this song?
          </Text>

          <View style={styles.playersGrid}>
            {players.map((player) => {
              // Determine style based on selection and result
              const isSelected = selectedPlayer === player.username;
              const isCorrect = currentSong?.assignedToPlayer?.username === player.username;
              const wasVoted = isSelected && showVoteResult;
              
              // Determine the button style for dynamic feedback
              let buttonStyle = styles.playerVoteButton;
              if (wasVoted) {
                if (isCorrect) {
                  buttonStyle = [styles.playerVoteButton, styles.correctVoteButton];
                } else {
                  buttonStyle = [styles.playerVoteButton, styles.incorrectVoteButton];
                }
              } else if (showVoteResult && isCorrect) {
                // Show correct answer even if not selected
                buttonStyle = [styles.playerVoteButton, styles.correctVoteButton];
              }
              
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

                    // Update points for @cole_sprout if the current user makes a correct guess
                    if (isCorrectGuess) {
                      setPlayerPoints(prev => ({
                        ...prev,
                        "@cole_sprout": (prev["@cole_sprout"] || 0) + 1
                      }));
                      console.log("Point awarded to @cole_sprout! New score:", playerPoints["@cole_sprout"] + 1);
                    }

                    console.log("Vote cast:", newVote);
                    
                    // In multiplayer mode, send the vote to the server
                    if (isMultiplayer) {
                      castVote(gameId, player.username);
                      
                      // In multiplayer, wait for the server's round_complete event
                      // Do not show the result alert or advance to next round immediately
                      Alert.alert(
                        isCorrectGuess ? "Vote Submitted" : "Vote Submitted",
                        "Waiting for other players to vote...",
                        [{ text: "OK" }]
                      );
                    } else {
                      // In single player mode, show result and allow advancing to next round immediately
                      setTimeout(() => {
                        Alert.alert(
                          isCorrectGuess ? "Correct!" : "Incorrect!",
                          isCorrectGuess
                            ? `Yes, ${player.username} listened to this song!`
                            : `Actually, ${currentSong?.assignedToPlayer?.username} listened to this song.`,
                          [
                            {
                              text: "Next Round",
                              onPress: () => {
                                // Reset voting states before moving to next round
                                nextRound(); // Call local nextRound function
                              },
                            },
                          ]
                        );
                      }, 800);
                    }
                  }}
                >
                  <View style={styles.profileImageContainer}>
                    <View style={styles.profileBackground}>
                      <Image
                        source={getProfilePhotoForUser(player.username)}
                        style={styles.profileImage}
                      />
                    </View>
                  </View>
                  <Text style={styles.playerVoteName}>{player.username}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      
      {gameStage === "results" && (
        <ScrollView contentContainerStyle={styles.resultsScrollContent}>
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Game Complete!</Text>

            <View style={styles.gameStats}>
              <Text style={styles.gameStatsHeader}>
              </Text>

              <Text style={styles.gameStatLine}>
                Players: {players.map((p) => p.username).join(", ")}
              </Text>

              <Text style={styles.gameStatLine}>
                Songs played: {currentRound}
              </Text>

              <Text style={styles.gameStatLine}>
                Game type: Guess The Listener
              </Text>
            </View>
            
            {/* Player scores section */}
            <View style={styles.scoresContainer}>
              <Text style={styles.scoresTitle}>Player Scores</Text>
              <View style={styles.scoresList}>
                {players.map(player => (
                  <View key={player.id} style={styles.scoreItem}>
                    <View style={styles.scorePlayerInfo}>
                      <Image 
                        source={getProfilePhotoForUser(player.username)}
                        style={styles.scorePlayerAvatar}
                      />
                      <Text style={styles.scorePlayerName}>{player.username}</Text>
                    </View>
                    <Text style={styles.scoreValue}>
                      {player.username === "@cole_sprout" 
                        ? playerPoints["@cole_sprout"] || 0 
                        : 0} 
                      points
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.reviewListContainer}>
              <Text style={styles.reviewListTitle}>Who listened to what?</Text>
              {Object.keys(roundSongs).map((round) => (
                <View key={round} style={styles.reviewListItem}>
                  <Image
                    source={{ uri: roundSongs[round].imageUrl }}
                    style={styles.reviewSongImage}
                  />
                  <View style={styles.reviewSongInfo}>
                    <Text style={styles.reviewSongTitle}>{roundSongs[round].songTitle}</Text>
                    <Text style={styles.reviewSongArtist}>
                      {roundSongs[round].songArtists.join(", ")}
                    </Text>
                  </View>
                  <View style={styles.reviewPlayerInfo}>
                    <View style={styles.reviewPlayerAvatarWrapper}>
                      <Image
                        source={getProfilePhotoForUser(
                          roundSongs[round].assignedToPlayer?.username || ""
                        )}
                        style={styles.reviewPlayerAvatar}
                      />
                    </View>
                    <Text style={styles.reviewPlayerName}>
                      {roundSongs[round].assignedToPlayer?.username}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.buttonsContainer}>
              <Pressable style={styles.returnButton} onPress={handleReturnToLobby}>
                <Text style={styles.returnButtonText}>Return to Lobby</Text>
              </Pressable>
              <Pressable style={styles.playAgainButton} onPress={handlePlayAgain}>
                <Text style={styles.playAgainButtonText}>Play Again</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}
      
      {/* Add a fallback loading state to make sure we render something */}
      {gameStage === "loading" && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8E44AD" />
          <Text style={styles.loadingText}>Loading game...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
