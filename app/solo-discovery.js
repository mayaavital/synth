import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useSpotifyAuth } from "../utils";
import { enrichTracksWithDeezerPreviews } from "../utils/deezerApi";

export default function SoloDiscovery() {
  const navigation = useNavigation();
  const router = useRouter();
  const { token, getValidToken } = useSpotifyAuth();

  // State for discovery mode selection
  const [discoveryMode, setDiscoveryMode] = useState("top_tracks"); // "top_tracks" or "search_based"
  const [seedSongs, setSeedSongs] = useState(["", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);

  // Audio playback state
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  // Set header
  useEffect(() => {
    navigation.setOptions({
      header: (props) => (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/")}
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Solo Discovery</Text>
          </View>

          <View style={[styles.placeholder, { width: 44 }]} />
        </View>
      ),
    });
  }, [navigation]);

  // Update seed song input
  const updateSeedSong = (index, value) => {
    const newSeedSongs = [...seedSongs];
    newSeedSongs[index] = value;
    setSeedSongs(newSeedSongs);
  };

  // Get user's top tracks and find similar music
  const getDiscoveryFromTopTracks = async () => {
    const validToken = await getValidToken();
    if (!validToken) {
      throw new Error("No valid Spotify token");
    }

    console.log("Getting user's top tracks for discovery...");
    
    // Get user's top tracks (this endpoint is still available)
    const topTracksUrl = `https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=medium_term`;
    const response = await fetch(topTracksUrl, {
      headers: {
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get top tracks: ${response.status}`);
    }
    
    const data = await response.json();
    const topTracks = data.items || [];
    
    if (topTracks.length === 0) {
      throw new Error("No top tracks found. Please listen to more music on Spotify first.");
    }
    
    console.log(`Found ${topTracks.length} top tracks`);
    
    // Shuffle the top tracks to randomize which ones we use as seeds
    const shuffledTopTracks = [...topTracks];
    for (let i = shuffledTopTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledTopTracks[i], shuffledTopTracks[j]] = [shuffledTopTracks[j], shuffledTopTracks[i]];
    }
    
    // Extract unique artists from shuffled top tracks
    const artistIds = new Set();
    shuffledTopTracks.forEach(track => {
      track.artists.forEach(artist => {
        artistIds.add(artist.id);
      });
    });
    
    // Convert to array and shuffle the artist IDs
    const uniqueArtistIds = Array.from(artistIds);
    for (let i = uniqueArtistIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniqueArtistIds[i], uniqueArtistIds[j]] = [uniqueArtistIds[j], uniqueArtistIds[i]];
    }
    
    // Randomly select 3-7 artists (variable number for more diversity)
    const numArtistsToUse = Math.min(uniqueArtistIds.length, Math.floor(Math.random() * 5) + 3); // 3-7 artists
    const selectedArtistIds = uniqueArtistIds.slice(0, numArtistsToUse);
    
    console.log(`Randomly selected ${selectedArtistIds.length} artists from ${uniqueArtistIds.length} unique artists`);
    
    // Get albums from these randomly selected artists
    const discoveryTracks = [];
    
    for (const artistId of selectedArtistIds) {
      try {
        // Get artist's albums
        const albumsUrl = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&market=US&limit=15`;
        const albumsResponse = await fetch(albumsUrl, {
          headers: {
            'Authorization': `Bearer ${validToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (albumsResponse.ok) {
          const albumsData = await albumsResponse.json();
          const albums = albumsData.items || [];
          
          // Shuffle the albums to randomize selection
          const shuffledAlbums = [...albums];
          for (let i = shuffledAlbums.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledAlbums[i], shuffledAlbums[j]] = [shuffledAlbums[j], shuffledAlbums[i]];
          }
          
          // Randomly select 1-3 albums per artist
          const numAlbumsToUse = Math.min(shuffledAlbums.length, Math.floor(Math.random() * 3) + 1); // 1-3 albums
          const selectedAlbums = shuffledAlbums.slice(0, numAlbumsToUse);
          
          // Get tracks from randomly selected albums
          for (const album of selectedAlbums) {
            const tracksUrl = `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=8`;
            const tracksResponse = await fetch(tracksUrl, {
              headers: {
                'Authorization': `Bearer ${validToken}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (tracksResponse.ok) {
              const tracksData = await tracksResponse.json();
              const tracks = tracksData.items || [];
              
              // Shuffle tracks within the album
              const shuffledTracks = [...tracks];
              for (let i = shuffledTracks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledTracks[i], shuffledTracks[j]] = [shuffledTracks[j], shuffledTracks[i]];
              }
              
              // Take a random subset of tracks from this album
              const numTracksToTake = Math.min(shuffledTracks.length, Math.floor(Math.random() * 4) + 2); // 2-5 tracks per album
              
              shuffledTracks.slice(0, numTracksToTake).forEach(track => {
                // Skip if this track is already in user's top tracks
                const isTopTrack = topTracks.some(topTrack => topTrack.id === track.id);
                if (!isTopTrack) {
                  discoveryTracks.push({
                    songTitle: track.name,
                    songArtists: track.artists.map(artist => artist.name),
                    albumName: album.name,
                    imageUrl: album.images?.[0]?.url,
                    duration: track.duration_ms,
                    externalUrl: track.external_urls?.spotify,
                    previewUrl: track.preview_url,
                    uri: track.uri,
                    trackId: track.id,
                    popularity: track.popularity || 0,
                  });
                }
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error getting albums for artist ${artistId}:`, error);
      }
    }
    
    // Remove duplicates and shuffle
    const uniqueTracks = discoveryTracks.filter((track, index, self) => 
      index === self.findIndex(t => t.trackId === track.trackId)
    );
    
    // Final shuffle of all discovery tracks
    for (let i = uniqueTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniqueTracks[i], uniqueTracks[j]] = [uniqueTracks[j], uniqueTracks[i]];
    }
    
    console.log(`Generated ${uniqueTracks.length} randomized discovery tracks from ${selectedArtistIds.length} artists`);
    return uniqueTracks.slice(0, 12); // Return up to 12 tracks for more variety
  };

  // Search for tracks based on user input and find similar music
  const getDiscoveryFromSearch = async (songNames) => {
    const validToken = await getValidToken();
    if (!validToken) {
      throw new Error("No valid Spotify token");
    }

    console.log("Searching for similar music based on input songs...");
    
    const allDiscoveryTracks = [];
    
    for (const songName of songNames) {
      if (!songName.trim()) continue;
      
      try {
        // Search for the song
        const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(songName)}&type=track&limit=1`;
        const response = await fetch(searchUrl, {
          headers: {
            'Authorization': `Bearer ${validToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) continue;
        
        const data = await response.json();
        const track = data.tracks?.items?.[0];
        
        if (!track) continue;
        
        console.log(`Found track: "${track.name}" by ${track.artists[0].name}`);
        
        // Get the artist's other albums/tracks
        const artistId = track.artists[0].id;
        const albumsUrl = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&market=US&limit=8`;
        const albumsResponse = await fetch(albumsUrl, {
          headers: {
            'Authorization': `Bearer ${validToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (albumsResponse.ok) {
          const albumsData = await albumsResponse.json();
          const albums = albumsData.items || [];
          
          // Get tracks from albums
          for (const album of albums.slice(0, 3)) {
            const tracksUrl = `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=3`;
            const tracksResponse = await fetch(tracksUrl, {
              headers: {
                'Authorization': `Bearer ${validToken}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (tracksResponse.ok) {
              const tracksData = await tracksResponse.json();
              const tracks = tracksData.items || [];
              
              tracks.forEach(albumTrack => {
                // Skip the original track we searched for
                if (albumTrack.id !== track.id) {
                  allDiscoveryTracks.push({
                    songTitle: albumTrack.name,
                    songArtists: albumTrack.artists.map(artist => artist.name),
                    albumName: album.name,
                    imageUrl: album.images?.[0]?.url,
                    duration: albumTrack.duration_ms,
                    externalUrl: albumTrack.external_urls?.spotify,
                    previewUrl: albumTrack.preview_url,
                    uri: albumTrack.uri,
                    trackId: albumTrack.id,
                    popularity: albumTrack.popularity || 0,
                  });
                }
              });
            }
          }
        }
        
        // Also search for similar artists by searching for genre-related terms
        const artistName = track.artists[0].name;
        const genreSearchUrl = `https://api.spotify.com/v1/search?q=genre:"${encodeURIComponent(artistName)}"&type=artist&limit=5`;
        const genreResponse = await fetch(genreSearchUrl, {
          headers: {
            'Authorization': `Bearer ${validToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (genreResponse.ok) {
          const genreData = await genreResponse.json();
          const similarArtists = genreData.artists?.items || [];
          
          for (const similarArtist of similarArtists.slice(0, 2)) {
            if (similarArtist.id === artistId) continue; // Skip the original artist
            
            // Get top tracks from similar artist
            const topTracksUrl = `https://api.spotify.com/v1/artists/${similarArtist.id}/top-tracks?market=US`;
            const topTracksResponse = await fetch(topTracksUrl, {
              headers: {
                'Authorization': `Bearer ${validToken}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (topTracksResponse.ok) {
              const topTracksData = await topTracksResponse.json();
              const topTracks = topTracksData.tracks || [];
              
              topTracks.slice(0, 2).forEach(topTrack => {
                allDiscoveryTracks.push({
                  songTitle: topTrack.name,
                  songArtists: topTrack.artists.map(artist => artist.name),
                  albumName: topTrack.album?.name,
                  imageUrl: topTrack.album?.images?.[0]?.url,
                  duration: topTrack.duration_ms,
                  externalUrl: topTrack.external_urls?.spotify,
                  previewUrl: topTrack.preview_url,
                  uri: topTrack.uri,
                  trackId: topTrack.id,
                  popularity: topTrack.popularity || 0,
                });
              });
            }
          }
        }
        
      } catch (error) {
        console.error(`Error processing song "${songName}":`, error);
      }
    }
    
    // Remove duplicates and shuffle
    const uniqueTracks = allDiscoveryTracks.filter((track, index, self) => 
      index === self.findIndex(t => t.trackId === track.trackId)
    );
    
    // Shuffle the tracks
    for (let i = uniqueTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniqueTracks[i], uniqueTracks[j]] = [uniqueTracks[j], uniqueTracks[i]];
    }
    
    console.log(`Generated ${uniqueTracks.length} discovery tracks from search`);
    return uniqueTracks.slice(0, 10); // Return up to 10 tracks
  };

  // Start the discovery game
  const startDiscovery = async () => {
    setIsLoading(true);
    
    try {
      console.log(`Starting discovery in ${discoveryMode} mode`);
      
      let discoveryTracks = [];
      
      if (discoveryMode === "top_tracks") {
        discoveryTracks = await getDiscoveryFromTopTracks();
      } else {
        const filledSongs = seedSongs.filter(song => song.trim() !== "");
        
        if (filledSongs.length === 0) {
          Alert.alert("No Songs", "Please enter at least one song to get recommendations.");
          setIsLoading(false);
          return;
        }
        
        discoveryTracks = await getDiscoveryFromSearch(filledSongs);
      }
      
      if (discoveryTracks.length === 0) {
        Alert.alert(
          "No Recommendations", 
          "Could not find similar tracks. Please try a different approach or check your Spotify listening history."
        );
        setIsLoading(false);
        return;
      }
      
      console.log(`Got ${discoveryTracks.length} discovery tracks`);
      
      // Enrich with Deezer previews
      console.log("Enriching recommendations with Deezer previews...");
      const enrichedRecs = await enrichTracksWithDeezerPreviews(discoveryTracks);
      
      const tracksWithPreviews = enrichedRecs.filter(track => track.previewUrl);
      console.log(`${tracksWithPreviews.length} tracks have preview URLs after Deezer enrichment`);
      
      if (tracksWithPreviews.length === 0) {
        // Use original recommendations even without previews
        setRecommendations(enrichedRecs.slice(0, 6)); // Limit to 6 tracks
      } else {
        setRecommendations(tracksWithPreviews.slice(0, 6)); // Limit to 6 tracks
      }
      
      setCurrentTrackIndex(0);
      setGameStarted(true);
      
    } catch (error) {
      console.error("Error starting discovery:", error);
      Alert.alert(
        "Error", 
        error.message || "There was an error getting recommendations. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Audio playback functions
  const onPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) return;

    setPlaybackPosition(status.positionMillis || 0);
    setPlaybackDuration(status.durationMillis || 0);
    setIsPlaying(status.isPlaying || false);

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPlaybackPosition(0);
    }
  };

  const loadAndPlayAudio = async (track) => {
    if (!track.previewUrl) {
      console.log(`No preview URL for track: "${track.songTitle}"`);
      Alert.alert("No Preview", "No audio preview available for this track.");
      return;
    }

    console.log(`Loading audio for: "${track.songTitle}" by ${track.songArtists.join(", ")}`);
    console.log(`Preview URL: ${track.previewUrl}`);
    setIsLoadingAudio(true);

    try {
      // Stop and unload any existing sound
      if (sound) {
        console.log("Stopping and unloading previous audio");
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }

      // Reset audio state
      setIsPlaying(false);
      setPlaybackPosition(0);
      setPlaybackDuration(0);

      // For mobile devices, don't autoplay - let user manually start
      const shouldAutoPlay = Platform.OS !== 'web' || !navigator.userAgent.match(/Mobile|Android|iPhone|iPad/i);

      console.log(`Creating new audio instance with autoplay: ${shouldAutoPlay}`);
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: track.previewUrl },
        { shouldPlay: shouldAutoPlay },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setIsPlaying(shouldAutoPlay);
      
      if (shouldAutoPlay) {
        console.log(`Audio started playing automatically for: "${track.songTitle}"`);
      } else {
        console.log(`Audio loaded for: "${track.songTitle}", manual play required on mobile`);
      }
    } catch (error) {
      console.error(`Error loading audio for "${track.songTitle}":`, error);
      Alert.alert("Audio Error", "Could not load audio preview. Please try again.");
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const togglePlayPause = async () => {
    const currentTrack = recommendations[currentTrackIndex];
    
    if (!currentTrack) {
      console.log("No current track available");
      return;
    }

    // If no sound is loaded, or if we have a sound but it's for a different track, load the current track
    if (!sound) {
      console.log(`Loading audio for track: "${currentTrack.songTitle}"`);
      await loadAndPlayAudio(currentTrack);
      return;
    }

    try {
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) {
        console.log("Sound not loaded, loading current track");
        await loadAndPlayAudio(currentTrack);
        return;
      }

      if (isPlaying) {
        console.log("Pausing audio");
        await sound.pauseAsync();
      } else {
        console.log("Resuming audio");
        await sound.playAsync();
      }
    } catch (error) {
      console.error("Error toggling playback:", error);
      // If there's an error, try to reload the audio
      console.log("Reloading audio due to error");
      await loadAndPlayAudio(currentTrack);
    }
  };

  // Cleanup audio when component unmounts or track changes
  useEffect(() => {
    return () => {
      if (sound) {
        console.log("Cleaning up audio resources");
        sound.unloadAsync().catch(e => console.log("Error unloading sound:", e));
      }
    };
  }, [sound]);

  // Stop audio when track changes
  useEffect(() => {
    const stopAndClearAudio = async () => {
      if (sound) {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch (error) {
          console.log("Error stopping/unloading sound:", error);
        }
        setSound(null);
      }
      setIsPlaying(false);
      setPlaybackPosition(0);
      setPlaybackDuration(0);
      setIsLoadingAudio(false);
    };

    stopAndClearAudio();
  }, [currentTrackIndex]);

  // Navigate to next track
  const nextTrack = () => {
    if (currentTrackIndex < recommendations.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1);
    } else {
      // End of recommendations
      Alert.alert(
        "Discovery Complete!",
        "You've listened to all recommendations. Would you like to start over?",
        [
          { text: "New Discovery", onPress: () => {
            setGameStarted(false);
            setRecommendations([]);
            setCurrentTrackIndex(0);
            setSeedSongs(["", "", ""]);
            // Clear audio state when starting over
            if (sound) {
              sound.unloadAsync().catch(e => console.log("Error unloading sound:", e));
              setSound(null);
            }
            setIsPlaying(false);
            setPlaybackPosition(0);
            setPlaybackDuration(0);
          }},
          { text: "Go Back", onPress: () => router.back() }
        ]
      );
    }
  };

  // Navigate to previous track
  const previousTrack = () => {
    if (currentTrackIndex > 0) {
      setCurrentTrackIndex(currentTrackIndex - 1);
    }
  };

  // Open song in Spotify
  const openInSpotify = (track) => {
    if (track.externalUrl) {
      // Use Linking to open Spotify
      import('react-native').then(({ Linking }) => {
        Linking.openURL(track.externalUrl);
      });
    } else {
      Alert.alert("Not Available", "Spotify link not available for this track.");
    }
  };

  const currentTrack = recommendations[currentTrackIndex];

  if (!gameStarted) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.setupContainer}>
            <Text style={styles.title}>Discover New Music</Text>
            <Text style={styles.subtitle}>
              Choose how you'd like to discover new music. We'll find tracks you haven't heard before!
            </Text>

            {/* Discovery Mode Selection */}
            <View style={styles.modeContainer}>
              <Text style={styles.modeTitle}>Discovery Method:</Text>
              
              <TouchableOpacity
                style={[
                  styles.modeOption,
                  discoveryMode === "top_tracks" && styles.modeOptionSelected
                ]}
                onPress={() => setDiscoveryMode("top_tracks")}
              >
                <View style={styles.modeOptionContent}>
                  <Ionicons 
                    name="trending-up" 
                    size={24} 
                    color={discoveryMode === "top_tracks" ? "#8E44AD" : "white"} 
                  />
                  <View style={styles.modeTextContainer}>
                    <Text style={[
                      styles.modeOptionTitle,
                      discoveryMode === "top_tracks" && styles.modeOptionTitleSelected
                    ]}>
                      Based on Your Top Tracks
                    </Text>
                    <Text style={styles.modeOptionDescription}>
                      Discover new music from artists similar to your most-played songs
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeOption,
                  discoveryMode === "search_based" && styles.modeOptionSelected
                ]}
                onPress={() => setDiscoveryMode("search_based")}
              >
                <View style={styles.modeOptionContent}>
                  <Ionicons 
                    name="search" 
                    size={24} 
                    color={discoveryMode === "search_based" ? "#8E44AD" : "white"} 
                  />
                  <View style={styles.modeTextContainer}>
                    <Text style={[
                      styles.modeOptionTitle,
                      discoveryMode === "search_based" && styles.modeOptionTitleSelected
                    ]}>
                      Based on Specific Songs
                    </Text>
                    <Text style={styles.modeOptionDescription}>
                      Enter up to 3 songs you love and find similar tracks
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Song Input (only show if search_based mode is selected) */}
            {discoveryMode === "search_based" && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputSectionTitle}>Enter Songs You Love:</Text>
                {seedSongs.map((song, index) => (
                  <View key={index} style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Song {index + 1}:</Text>
                    <TextInput
                      style={styles.textInput}
                      value={song}
                      onChangeText={(text) => updateSeedSong(index, text)}
                      placeholder={`Enter song ${index + 1} (e.g., "Bohemian Rhapsody")`}
                      placeholderTextColor="#888"
                    />
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.startButton,
                isLoading && styles.disabledButton
              ]}
              onPress={startDiscovery}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="play" size={24} color="white" />
                  <Text style={styles.startButtonText}>Start Discovery</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Note about deprecated APIs */}
            <View style={styles.noteContainer}>
              <Ionicons name="information-circle" size={20} color="#FFC857" />
              <Text style={styles.noteText}>
                Note: Due to recent Spotify API changes, we use alternative methods to find similar music. 
                Results may vary from traditional recommendation systems.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.gameContainer}>
          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              Track {currentTrackIndex + 1} of {recommendations.length}
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${((currentTrackIndex + 1) / recommendations.length) * 100}%` }
                ]} 
              />
            </View>
          </View>

          {/* Current track display */}
          {currentTrack && (
            <View style={styles.trackContainer}>
              <View style={styles.albumArtContainer}>
                <Image
                  source={{ uri: currentTrack.imageUrl || 'https://via.placeholder.com/300' }}
                  style={styles.albumArt}
                  resizeMode="cover"
                />
              </View>

              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle} numberOfLines={2}>
                  {currentTrack.songTitle}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {currentTrack.songArtists.join(", ")}
                </Text>
                <Text style={styles.trackAlbum} numberOfLines={1}>
                  {currentTrack.albumName}
                </Text>
              </View>

              {/* Action buttons */}
              <View style={styles.actionButtons}>
                {/* Audio playback controls */}
                <View style={styles.audioControls}>
                  <TouchableOpacity
                    style={[
                      styles.playButton,
                      isLoadingAudio && styles.playButtonDisabled
                    ]}
                    onPress={togglePlayPause}
                    disabled={isLoadingAudio}
                  >
                    {isLoadingAudio ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons
                        name={isPlaying ? "pause" : "play"}
                        size={24}
                        color="white"
                      />
                    )}
                  </TouchableOpacity>

                  {/* Audio progress indicator */}
                  {(sound || isLoadingAudio) && (
                    <View style={styles.audioProgressContainer}>
                      <View style={styles.audioProgressBar}>
                        <View
                          style={[
                            styles.audioProgressFill,
                            {
                              width: `${
                                playbackDuration > 0
                                  ? Math.min(100, (playbackPosition / playbackDuration) * 100)
                                  : 0
                              }%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.audioTimeText}>
                        {Math.floor(playbackPosition / 1000)}s / {Math.floor(playbackDuration / 1000)}s
                      </Text>
                    </View>
                  )}

                  {/* Show preview availability status */}
                  {!currentTrack.previewUrl && (
                    <Text style={styles.noPreviewText}>No audio preview available</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.spotifyButton}
                  onPress={() => openInSpotify(currentTrack)}
                >
                  <Image
                    source={require("../assets/white-spotify-logo.png")}
                    style={styles.spotifyIcon}
                  />
                  <Text style={styles.spotifyButtonText}>Open in Spotify</Text>
                </TouchableOpacity>
              </View>

              {/* Navigation buttons */}
              <View style={styles.navigationButtons}>
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    currentTrackIndex === 0 && styles.disabledNavButton
                  ]}
                  onPress={previousTrack}
                  disabled={currentTrackIndex === 0}
                >
                  <Ionicons 
                    name="chevron-back" 
                    size={24} 
                    color={currentTrackIndex === 0 ? "#666" : "white"} 
                  />
                  <Text style={[
                    styles.navButtonText,
                    currentTrackIndex === 0 && styles.disabledNavButtonText
                  ]}>
                    Previous
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.navButton}
                  onPress={nextTrack}
                >
                  <Text style={styles.navButtonText}>
                    {currentTrackIndex === recommendations.length - 1 ? "Finish" : "Next"}
                  </Text>
                  <Ionicons name="chevron-forward" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          )}
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
  scrollContent: {
    flexGrow: 1,
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
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    bottom: 10,
  },
  placeholder: {
    width: 44,
  },
  setupContainer: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    color: "#CCC",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 24,
  },
  modeContainer: {
    marginBottom: 30,
  },
  modeTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
  },
  modeOption: {
    backgroundColor: "#333",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#555",
  },
  modeOptionSelected: {
    borderColor: "#8E44AD",
    backgroundColor: "#2A1A3A",
  },
  modeOptionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  modeTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  modeOptionTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  modeOptionTitleSelected: {
    color: "#8E44AD",
  },
  modeOptionDescription: {
    color: "#AAA",
    fontSize: 14,
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: 30,
  },
  inputSectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
  },
  inputWrapper: {
    marginBottom: 15,
  },
  inputLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#333",
    color: "white",
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#555",
  },
  startButton: {
    backgroundColor: "#8E44AD",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 25,
    shadowColor: "#8E44AD",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: "#666",
    shadowOpacity: 0,
  },
  startButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  noteContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#2A2A2A",
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#FFC857",
  },
  noteText: {
    color: "#CCC",
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 10,
    flex: 1,
  },
  gameContainer: {
    flex: 1,
    padding: 20,
  },
  progressContainer: {
    marginBottom: 30,
  },
  progressText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#8E44AD",
  },
  trackContainer: {
    alignItems: "center",
    borderRadius: 15,
    // overflow: "hidden",
  },
  albumArtContainer: {
    marginBottom: 20,
    shadowColor: "#8E44AD",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    borderRadius: 15
    // elevation: 10,
  },
  albumArt: {
    width: 250,
    height: 250,
    borderRadius: 15,
  },
  trackInfo: {
    alignItems: "center",
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  trackTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  trackArtist: {
    color: "#CCC",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 4,
  },
  trackAlbum: {
    color: "#888",
    fontSize: 16,
    textAlign: "center",
  },
  actionButtons: {
    marginBottom: 30,
    alignItems: "center",
  },
  audioControls: {
    alignItems: "center",
    marginBottom: 20,
  },
  playButton: {
    backgroundColor: "#8E44AD",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
    shadowColor: "#8E44AD",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 5,
  },
  playButtonDisabled: {
    backgroundColor: "#666",
    shadowOpacity: 0,
  },
  audioProgressContainer: {
    alignItems: "center",
    width: "80%",
    marginBottom: 10,
  },
  audioProgressBar: {
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    overflow: "hidden",
    width: "100%",
    marginBottom: 8,
  },
  audioProgressFill: {
    height: "100%",
    backgroundColor: "#8E44AD",
  },
  audioTimeText: {
    color: "#AAA",
    fontSize: 12,
  },
  noPreviewText: {
    color: "#888",
    fontSize: 14,
    fontStyle: "italic",
  },
  spotifyButton: {
    backgroundColor: "#1DB954",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 25,
    paddingHorizontal: 20,
  },
  spotifyIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  spotifyButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  navigationButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 20,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    padding: 12,
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  disabledNavButton: {
    backgroundColor: "#222",
  },
  navButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginHorizontal: 8,
  },
  disabledNavButtonText: {
    color: "#666",
  },
}); 