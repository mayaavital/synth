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
} from "react-native";
import { useNavigation, useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef } from "react";
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

const ALBUM_ID = "2noRn2Aes5aoNVsU6iWThc";
const ROUNDS_TOTAL = 3;
const MIN_PLAY_DURATION = 15000; // Set to 15 seconds as specified

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
      // headerShown: true,
      // headerTitleStyle: {
      //   color: "#FFC857", // Golden yellow color
      //   fontSize: 28,
      //   fontWeight: "bold",
      //   letterSpacing: 2,
      // },
      // headerStyle: { backgroundColor: "#8E44AD", height: 60 + insets.top},
      // headerLeft: () => (
      //   <TouchableOpacity
      //     style={styles.menuButton}
      //     onPress={() => navigation.goBack()}
      //   >
      //     <Ionicons name="arrow-back" size={28} color="white" />
      //   </TouchableOpacity>
      // ),
      //  title: gameName,
      header: (props) => (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.logoText}>{gameName}</Text>
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
        assignedToPlayer: players[Math.floor(Math.random() * players.length)],
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

    // Enable voting after at least 15 seconds
    // Add logging to debug this issue
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

    // Verify we have a valid song object
    if (!song) {
      console.error("No song provided to loadAndPlaySong");
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
      // Unload any existing sound
      if (sound) {
        await sound.unloadAsync();
      }

      // Set timeout to handle case where audio loading takes too long
      if (audioLoadTimeoutRef.current) {
        clearTimeout(audioLoadTimeoutRef.current);
      }

      audioLoadTimeoutRef.current = setTimeout(() => {
        setIsLoadingAudio(false);
        setAudioLoadError("Audio loading timed out. You can still vote.");
        setCanVote(true);
      }, 15000);

      // Create a new sound object
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: song.previewUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 100 },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setIsPlaying(true);
      setIsLoadingAudio(false);

      // Clear the timeout if audio loaded successfully
      clearTimeout(audioLoadTimeoutRef.current);
      audioLoadTimeoutRef.current = null;

      console.log("Audio loaded and playing successfully");
    } catch (error) {
      console.error("Error loading audio:", error);
      setIsLoadingAudio(false);
      setAudioLoadError("Error loading audio. You can still vote.");
      setCanVote(true);

      // Clear the timeout if we've already handled the error
      if (audioLoadTimeoutRef.current) {
        clearTimeout(audioLoadTimeoutRef.current);
        audioLoadTimeoutRef.current = null;
      }
    }
  };

  // Toggle play/pause function
  const togglePlayPause = async () => {
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

  // Fix the selectSongForRound function to call loadAndPlaySong
  const selectSongForRound = (round, songs = allSongs) => {
    if (!songs || songs.length === 0) return;

    // Select a song based on round number (for demo purposes)
    // In a real game, you'd want to ensure no duplicates between rounds
    const index = (round - 1) % songs.length;
    // Select a random song index instead of sequential
    const randomIndex = Math.floor(Math.random() * songs.length);
    // TODO: Add logic here to ensure the same song isn't picked twice in a game if needed.

    // Load the selected song (this will set currentSong)
    loadAndPlaySong(songs[randomIndex]);
  };

  // Fix the nextRound function to properly reset canVote state
  const nextRound = async () => {
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
    }
  };

  const handleReturnToLobby = () => {
    router.replace("/game-lobby");
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {/* <View style={styles.header}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.logoText}>SYNTH</Text>
          <View style={styles.placeholder} />
        </View> */}

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
        {/* <View style={styles.header}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.logoText}>SYNTH</Text>
          <View style={styles.placeholder} />
        </View> */}

        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={handleReturnToLobby}>
            <Text style={styles.retryButtonText}>Back to Lobby</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.logoText}>SYNTH</Text>
        <View style={styles.placeholder} />
      </View> */}

      <View style={styles.gameStatusBar}>
        <Text style={styles.roundText}>
          Round {currentRound} of {ROUNDS_TOTAL}
        </Text>
      </View>

      {currentSong && gameStage === "playing" && (
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
            <Text style={styles.playbackSongTitle}>
              {currentSong.songTitle}
            </Text>
            <Text style={styles.playbackArtistName}>
              {currentSong.songArtists.join(", ")}
            </Text>
          </View>

          {/* Playback controls */}
          <View style={styles.playbackControlsContainer}>
            {isLoadingAudio ? (
              <View style={styles.loadingAudioContainer}>
                <ActivityIndicator size="small" color="#C143FF" />
                <Text style={styles.loadingAudioText}>Loading audio...</Text>
              </View>
            ) : audioLoadError ? (
              <View style={styles.audioErrorContainer}>
                <Text style={styles.audioErrorText}>{audioLoadError}</Text>
                {currentSong?.externalUrl && (
                  <TouchableOpacity
                    style={[
                      styles.externalLinkButton,
                      styles.spotifyLinkButton,
                    ]}
                    onPress={() =>
                      Linking.openURL(
                        // Always use Spotify URL for external linking
                        currentSong.externalUrl
                      )
                    }
                  >
                    {/* Show Spotify logo from assets */}
                    <Image
                      source={require("../assets/white-spotify-logo.png")}
                      style={{ width: 20, height: 20, marginRight: 5 }}
                    />
                    <Text style={styles.externalLinkText}>Open in Spotify</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                {/* Progress bar */}
                <View style={styles.progressContainer}>
                  <Text style={styles.timeText}>
                    {formatTime(playbackPosition)}
                  </Text>
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
                  <Text style={styles.timeText}>
                    {formatTime(playbackDuration)}
                  </Text>
                </View>

                {/* Play/pause button */}
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
                </View>

                {/* External link button */}
                {currentSong?.externalUrl && (
                  <TouchableOpacity
                    style={[
                      styles.externalLinkButton,
                      styles.spotifyLinkButton,
                    ]}
                    onPress={() =>
                      Linking.openURL(
                        // Always use Spotify URL for external linking
                        currentSong.externalUrl
                      )
                    }
                  >
                    {/* Show Spotify logo from assets */}
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

          {/* Bottom vote button - update to be enabled after minimum play time */}
          <View style={styles.voteButtonContainer}>
            <Pressable
              style={[
                styles.voteButton,
                !canVote ? styles.voteButtonDisabled : styles.voteButtonEnabled,
              ]}
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
              disabled={!canVote}
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
            </Pressable>
            {/* Countdown removed */}
            <Text style={styles.voteHintText}>
              {canVote
                ? "Make your guess about who listened to this song"
                : `Listen for ${
                    MIN_PLAY_DURATION / 1000
                  } seconds before voting...`}
            </Text>
          </View>
        </View>
      )}

      {gameStage === "voting" && (
        <View style={styles.votingContainer}>
          <Text style={styles.votingInstructions}>
            Who do you think listened to this song?
          </Text>

          <View style={styles.playersGrid}>
            {players.map((player) => (
              <Pressable
                key={player.id}
                style={styles.playerVoteButton}
                onPress={() => {
                  // Store the vote (in a real app, you'd send this to a backend)
                  const newVote = {
                    round: currentRound,
                    songId: currentSong?.songTitle,
                    votedFor: player.username,
                    correctPlayer: currentSong?.assignedToPlayer?.username,
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
                    [
                      {
                        text: "Next Round",
                        onPress: () => nextRound(),
                      },
                    ]
                  );
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
            ))}
          </View>
        </View>
      )}

      {gameStage === "results" && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Game Complete!</Text>

          <View style={styles.gameStats}>
            <Text style={styles.gameStatsHeader}>
              {/* {gameName} - Game #{gameId.split("-")[1].substring(0, 6)} */}
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

          {/* Song-to-player review */}
          <View style={styles.reviewListContainer}>
            <Text style={styles.reviewListTitle}>Who listened to what?</Text>
            {allSongs.slice(0, currentRound).map((song, idx) => (
              <View key={idx} style={styles.reviewListItem}>
                <Image
                  source={{ uri: song.imageUrl }}
                  style={styles.reviewSongImage}
                />
                <View style={styles.reviewSongInfo}>
                  <Text style={styles.reviewSongTitle}>{song.songTitle}</Text>
                  <Text style={styles.reviewSongArtist}>
                    {song.songArtists.join(", ")}
                  </Text>
                </View>
                <View style={styles.reviewPlayerInfo}>
                  <View style={styles.reviewPlayerAvatarWrapper}>
                    <Image
                      source={getProfilePhotoForUser(
                        song.assignedToPlayer?.username || ""
                      )}
                      style={styles.reviewPlayerAvatar}
                    />
                  </View>
                  <Text style={styles.reviewPlayerName}>
                    {song.assignedToPlayer?.username}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable style={styles.returnButton} onPress={handleReturnToLobby}>
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

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: "#8E44AD", // Purple background for header
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
  logoText: {
    color: "#FFC857", // Golden yellow color
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
    backgroundColor: "#1DB954", // Spotify green
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
  voteButton: {
    backgroundColor: "#7D7575", // Default to disabled state
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "80%",
    borderWidth: 2,
    borderColor: "#555",
    // Add transition-like styling
    shadowColor: "#333",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  voteButtonDisabled: {
    backgroundColor: "#7D7575", // Dimmed color for disabled state
    borderColor: "#555",
    opacity: 0.8, // Just slightly dimmed, but still clearly visible
  },
  voteButtonEnabled: {
    backgroundColor: "#FFC857", // Gold color for the enabled button
    borderColor: "#E6A100", // Darker gold border
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
    color: "#000", // Black text to match enabled state, just on gray background
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
    backgroundColor: "#8E44AD",
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
    backgroundColor: "#1DB954", // Spotify green
  },
  spotifyLinkButton: {
    backgroundColor: "#1DB954", // Spotify green
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
    borderWidth: 2,
    borderColor: "#FFC857",
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
});
