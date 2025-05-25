import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  Dimensions,
  Linking 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getMyRecentlyPlayedTracks } from '../utils/apiOptions';
import useSpotifyAuth from '../utils/useSpotifyAuth';

const { width: screenWidth } = Dimensions.get('window');
const ALBUM_SIZE = 120;
const ALBUM_MARGIN = 12;
const SCROLL_SPEED = 0.3; // pixels per frame (slower for smoother effect)
const ANIMATION_INTERVAL = 20; // ~50fps for smooth animation (slightly lower for better performance)

const AlbumCarousel = ({ style }) => {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { getValidToken } = useSpotifyAuth();
  const flatListRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const autoScrollTimerRef = useRef(null);
  const isPausedRef = useRef(false);
  const totalWidthRef = useRef(0);
  const resumeTimeoutRef = useRef(null);

  useEffect(() => {
    fetchRecentlyPlayedTracks();
    return () => {
      // Clean up timers on unmount
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Start auto-scrolling when we have albums
    if (albums.length > 1) {
      // Calculate total width for wrapping
      totalWidthRef.current = albums.length * (ALBUM_SIZE + ALBUM_MARGIN);
      startSmoothAutoScroll();
    }
    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, [albums]);

  const fetchRecentlyPlayedTracks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = await getValidToken();
      if (!token) {
        setError('No Spotify token available');
        return;
      }

      const tracksData = await getMyRecentlyPlayedTracks(token);
      if (tracksData && tracksData.length > 0) {
        // Extract unique albums from recently played tracks
        const uniqueAlbums = [];
        const seenAlbumIds = new Set();
        
        tracksData.forEach(track => {
          if (track.albumName && track.imageUrl && !seenAlbumIds.has(track.albumName + track.songArtists.join(''))) {
            seenAlbumIds.add(track.albumName + track.songArtists.join(''));
            uniqueAlbums.push({
              id: track.trackId || Math.random().toString(),
              name: track.albumName,
              artists: track.songArtists,
              imageUrl: track.imageUrl,
              externalUrl: track.externalUrl,
              songTitle: track.songTitle
            });
          }
        });
        
        // Take first 20 unique albums and duplicate for seamless looping
        const limitedAlbums = uniqueAlbums.slice(0, 20);
        // Duplicate the albums for seamless infinite scroll
        setAlbums([...limitedAlbums, ...limitedAlbums]);
      } else {
        setError('No recently played tracks found');
      }
    } catch (err) {
      console.error('Error fetching recently played tracks:', err);
      setError('Failed to load recent tracks');
    } finally {
      setLoading(false);
    }
  };

  const startSmoothAutoScroll = () => {
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
    }
    
    autoScrollTimerRef.current = setInterval(() => {
      if (!isPausedRef.current && flatListRef.current && albums.length > 1) {
        scrollPositionRef.current += SCROLL_SPEED;
        
        // Reset position when we've scrolled through half the items (since we duplicated them)
        const halfWidth = totalWidthRef.current / 2;
        if (scrollPositionRef.current >= halfWidth) {
          scrollPositionRef.current = 0;
        }
        
        flatListRef.current.scrollToOffset({
          offset: scrollPositionRef.current,
          animated: false // Use false for smooth continuous movement
        });
      }
    }, ANIMATION_INTERVAL);
  };

  const pauseAutoScroll = () => {
    isPausedRef.current = true;
    // Clear any existing resume timeout
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
  };

  const resumeAutoScroll = (delay = 3000) => {
    // Clear any existing resume timeout first
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
    }
    
    // Set new timeout to resume after delay
    resumeTimeoutRef.current = setTimeout(() => {
      isPausedRef.current = false;
      resumeTimeoutRef.current = null;
    }, delay);
  };

  const handleAlbumPress = async (album) => {
    // Pause auto-scroll temporarily when user interacts
    pauseAutoScroll();
    resumeAutoScroll(5000); // Resume after 5 seconds
    
    if (album.externalUrl) {
      try {
        await Linking.openURL(album.externalUrl);
      } catch (err) {
        console.error('Error opening Spotify URL:', err);
      }
    }
  };

  const renderAlbumItem = ({ item }) => (
    <TouchableOpacity
      style={styles.albumContainer}
      onPress={() => handleAlbumPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.albumCard}>
        {item.imageUrl ? (
          <Image 
            source={{ uri: item.imageUrl }} 
            style={styles.albumImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.albumPlaceholder}>
            <Text style={styles.placeholderText}>♪</Text>
          </View>
        )}
        
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.albumOverlay}
        >
          <Text style={styles.albumName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.albumArtist} numberOfLines={1}>
            {item.artists.join(', ')}
          </Text>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <Text style={styles.carouselTitle}>Recently Played</Text>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={styles.loadingText}>Loading your recent tracks...</Text>
        </View>
      </View>
    );
  }

  if (error || !albums.length) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Text style={styles.carouselTitle}>Recently Played</Text>
        <View style={styles.errorContent}>
          <Text style={styles.errorText}>
            {error || 'No recent tracks found'}
          </Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={fetchRecentlyPlayedTracks}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.carouselTitle}>Recently Played</Text>
      <FlatList
        ref={flatListRef}
        data={albums}
        renderItem={renderAlbumItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.flatListContent}
        ItemSeparatorComponent={() => <View style={{ width: ALBUM_MARGIN }} />}
        onScrollBeginDrag={() => {
          // Immediately pause auto-scroll when user starts touching/scrolling
          pauseAutoScroll();
        }}
        onScrollEndDrag={(event) => {
          // User finished dragging, check if momentum will occur
          if (Math.abs(event.nativeEvent.velocity?.x || 0) < 0.1) {
            // No significant momentum, treat this as the end of scrolling
            scrollPositionRef.current = event.nativeEvent.contentOffset.x;
            resumeAutoScroll(3000);
          }
          // If there is momentum, onMomentumScrollEnd will handle the resume
        }}
        onMomentumScrollBegin={() => {
          // Momentum scrolling started - keep auto-scroll paused
          pauseAutoScroll();
        }}
        onMomentumScrollEnd={(event) => {
          // All scrolling (drag + momentum) has completely stopped
          // Update our scroll position reference and start 3-second timer
          scrollPositionRef.current = event.nativeEvent.contentOffset.x;
          resumeAutoScroll(3000);
        }}
        decelerationRate="normal"
        snapToInterval={ALBUM_SIZE + ALBUM_MARGIN}
        snapToAlignment="start"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E1E',
    paddingVertical: 16,
  },
  carouselTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    marginHorizontal: 20,
  },
  flatListContent: {
    paddingHorizontal: 20,
  },
  albumContainer: {
    width: ALBUM_SIZE,
  },
  albumCard: {
    width: ALBUM_SIZE,
    height: ALBUM_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  albumImage: {
    width: '100%',
    height: '100%',
  },
  albumPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 32,
    color: '#666666',
  },
  albumOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  albumName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  albumArtist: {
    fontSize: 10,
    color: '#CCCCCC',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 180,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#CCCCCC',
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 180,
  },
  errorContent: {
    alignItems: 'center',
  },
  errorText: {
    color: '#CCCCCC',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AlbumCarousel; 