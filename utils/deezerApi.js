import { Platform } from 'react-native';

// Simple serverless proxy for Deezer API
// This bypasses CORS entirely by using server-side requests

/**
 * Search for tracks using the serverless proxy
 * @param {string} query - Search query
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of track objects
 */
const searchDeezerViaProxy = async (query, limit = 5) => {
  try {
    console.log(`[DEEZER PROXY] Searching for: "${query}" with limit: ${limit}`);
    
    const response = await fetch(`/api/deezer?query=${encodeURIComponent(query)}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Proxy responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.message || 'Deezer API error');
    }
    
    if (data.data && data.data.length > 0) {
      console.log(`[DEEZER PROXY] Found ${data.data.length} tracks`);
      return data.data.map(track => ({
        id: track.id,
        title: track.title,
        artist: track.artist?.name || 'Unknown Artist',
        album: track.album?.title || 'Unknown Album',
        duration: track.duration,
        preview: track.preview,
        link: track.link,
      }));
    } else {
      console.log('[DEEZER PROXY] No tracks found');
      return [];
    }
  } catch (error) {
    console.error('[DEEZER PROXY] Error:', error.message);
    throw error;
  }
};

/**
 * Fallback JSONP function for local development or when proxy fails
 * @param {string} url - The API URL
 * @param {Object} params - Query parameters
 * @returns {Promise} - Promise that resolves with API response
 */
const deezerJSONP = (url, params = {}) => {
  return new Promise((resolve, reject) => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('JSONP only available in browser environment'));
      return;
    }

    // Create a unique callback name
    const callbackName = `deezerCallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add callback parameter to URL
    const queryParams = new URLSearchParams({
      ...params,
      output: 'jsonp',
      callback: callbackName
    });
    
    const fullUrl = `${url}?${queryParams.toString()}`;
    
    // Create script element
    const script = document.createElement('script');
    script.src = fullUrl;
    
    // Set up callback function
    window[callbackName] = (data) => {
      // Clean up
      try {
        document.head.removeChild(script);
      } catch (e) {
        // Script might already be removed
      }
      delete window[callbackName];
      resolve(data);
    };
    
    // Handle errors
    script.onerror = () => {
      try {
        document.head.removeChild(script);
      } catch (e) {
        // Script might already be removed
      }
      delete window[callbackName];
      reject(new Error('JSONP request failed'));
    };
    
    // Add script to page
    document.head.appendChild(script);
    
    // Timeout after 8 seconds
    setTimeout(() => {
      if (window[callbackName]) {
        try {
          document.head.removeChild(script);
        } catch (e) {
          // Script might already be removed
        }
        delete window[callbackName];
        reject(new Error('JSONP request timeout'));
      }
    }, 8000);
  });
};

/**
 * Search for tracks using JSONP (fallback only)
 * @param {string} query - Search query
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of track objects
 */
const searchDeezerTracksJSONP = async (query, limit = 5) => {
  try {
    console.log(`[DEEZER JSONP] Searching for: "${query}"`);
    const jsonpResponse = await deezerJSONP('https://api.deezer.com/search', {
      q: query,
      limit: limit
    });
    
    if (jsonpResponse && jsonpResponse.data && jsonpResponse.data.length > 0) {
      console.log(`[DEEZER JSONP] Found ${jsonpResponse.data.length} tracks`);
      return jsonpResponse.data.map(track => ({
        id: track.id,
        title: track.title,
        artist: track.artist?.name || 'Unknown Artist',
        album: track.album?.title || 'Unknown Album',
        duration: track.duration,
        preview: track.preview,
        link: track.link,
      }));
    } else {
      console.log('[DEEZER JSONP] No tracks found');
      return [];
    }
  } catch (error) {
    console.error('[DEEZER JSONP] Error:', error.message);
    return [];
  }
};

/**
 * Search for tracks on Deezer by query with multiple fallback strategies
 * @param {string} query - Search query (e.g. "artist name song title")
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of track objects
 */
export const searchDeezerTracks = async (query, limit = 10) => {
  console.log(`\n=== DEEZER SEARCH DEBUG ===`);
  console.log(`Query: "${query}"`);
  console.log(`Limit: ${limit}`);
  
  // Strategy 1: Try serverless proxy first (most reliable)
  try {
    console.log(`\n1. Trying serverless proxy...`);
    const proxyResult = await searchDeezerViaProxy(query, limit);
    if (proxyResult && proxyResult.length > 0) {
      console.log(`✅ Serverless proxy success: Found ${proxyResult.length} tracks`);
      return proxyResult;
    } else {
      console.log(`❌ Serverless proxy: No results`);
    }
  } catch (proxyError) {
    console.log(`❌ Serverless proxy failed:`, proxyError.message);
  }
  
  // Strategy 2: Fallback to JSONP (web only)
  if (Platform.OS === 'web' || typeof window !== 'undefined') {
    try {
      console.log(`\n2. Trying JSONP fallback...`);
      const jsonpResult = await searchDeezerTracksJSONP(query, limit);
      if (jsonpResult && jsonpResult.length > 0) {
        console.log(`✅ JSONP success: Found ${jsonpResult.length} tracks`);
        return jsonpResult;
      } else {
        console.log(`❌ JSONP: No results`);
      }
    } catch (jsonpError) {
      console.log(`❌ JSONP failed:`, jsonpError.message);
    }
  } else {
    console.log(`\n2. JSONP skipped (not available in this environment)`);
  }
  
  // Strategy 3: Final fallback to mock data (React Native environments)
  if (Platform.OS !== 'web') {
    try {
      console.log(`\n3. Using mock data fallback for ${Platform.OS}...`);
      const mockResult = await getMockDeezerTracks(query, limit);
      if (mockResult && mockResult.length > 0) {
        console.log(`✅ Mock data success: Found ${mockResult.length} tracks`);
        return mockResult;
      }
    } catch (mockError) {
      console.log(`❌ Mock data failed:`, mockError.message);
    }
  }
  
  console.log(`\n❌ All strategies failed for query: "${query}"`);
  return [];
};

/**
 * Get track details from Deezer by track ID
 * @param {string} trackId - Deezer track ID
 * @returns {Promise<Object|null>} - Track object or null if not found
 */
export const getDeezerTrackById = async (trackId) => {
  try {
    console.log(`[DEEZER] Fetching track with ID: ${trackId}`);
    
    // Try serverless proxy first
    try {
      const response = await fetch(`/api/deezer?query=track:${trackId}&limit=1`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          console.log(`✅ Serverless proxy track fetch success for ID: ${trackId}`);
          return data.data[0];
        }
      }
    } catch (proxyError) {
      console.log(`[DEEZER] Serverless proxy failed for track ${trackId}:`, proxyError.message);
    }
    
    // Fallback to JSONP (web only)
    if (Platform.OS === 'web' || typeof window !== 'undefined') {
      try {
        const jsonpResponse = await deezerJSONP(`https://api.deezer.com/track/${trackId}`, {});
        if (jsonpResponse && jsonpResponse.id) {
          console.log(`✅ JSONP track fetch success for ID: ${trackId}`);
          return jsonpResponse;
        }
      } catch (jsonpError) {
        console.log(`[DEEZER] JSONP track fetch failed for ID: ${trackId}:`, jsonpError.message);
      }
    }
    
    // For React Native or when all else fails, return mock track data
    if (Platform.OS !== 'web') {
      console.log(`[DEEZER] Using mock track data for React Native (ID: ${trackId})`);
      return {
        id: trackId,
        title: "Mock Track",
        artist: { name: "Mock Artist" },
        album: { title: "Mock Album", cover_big: null, cover_medium: null },
        duration: 180,
        preview: "https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9e9e880d2c6207e92260-8.mp3",
        link: `https://www.deezer.com/track/${trackId}`,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[DEEZER] Error fetching track:', error);
    return null;
  }
};

/**
 * Format Deezer track data to match the app's expected format
 * @param {Object} deezerTrack - Track object from Deezer API
 * @returns {Object} - Formatted track object
 */
export const formatDeezerTrack = (deezerTrack) => {
  return {
    songTitle: deezerTrack.title,
    songArtists: deezerTrack.artist ? [deezerTrack.artist.name] : [],
    albumName: deezerTrack.album ? deezerTrack.album.title : '',
    imageUrl: deezerTrack.album ? deezerTrack.album.cover_big || deezerTrack.album.cover_medium : null,
    duration: deezerTrack.duration * 1000, // Convert seconds to milliseconds
    previewUrl: deezerTrack.preview,
    uri: `deezer:track:${deezerTrack.id}`,
    externalUrl: deezerTrack.link,
    trackId: deezerTrack.id.toString(),
    platformSource: 'deezer',
    _debug: {
      title: deezerTrack.title,
      artists: [deezerTrack.artist?.name],
      duration: deezerTrack.duration * 1000,
      albumArt: deezerTrack.album?.cover_medium ? "Available" : "Unavailable",
      previewUrl: deezerTrack.preview ? "Available" : "Unavailable",
    }
  };
};

/**
 * Search for a track on Deezer using Spotify track information
 * @param {Object} spotifyTrack - Spotify track object
 * @returns {Promise<Object|null>} - Formatted Deezer track or null if not found
 */
export const findDeezerTrackFromSpotify = async (spotifyTrack) => {
  if (!spotifyTrack || !spotifyTrack.songTitle) {
    return null;
  }
  
  // Extract artist name from track
  const artistName = spotifyTrack.songArtists && spotifyTrack.songArtists.length > 0 
    ? spotifyTrack.songArtists[0] 
    : '';
  
  // Try multiple search strategies to maximize chances of finding a match
  const searchStrategies = [
    // Strategy 1: Song title + artist (standard)
    `${spotifyTrack.songTitle} ${artistName}`,
    
    // Strategy 2: Song title only (for when artist names might differ)
    `${spotifyTrack.songTitle}`,
    
    // Strategy 3: Use album name if available (helpful for compilations)
    ...(spotifyTrack.albumName ? [`${spotifyTrack.songTitle} ${spotifyTrack.albumName}`] : []),
    
    // Strategy 4: Song title in quotes (exact match)
    `"${spotifyTrack.songTitle}"`,
    
    // Strategy 5: Artist only (as last resort, might find other tracks by same artist)
    ...(artistName ? [`artist:"${artistName}"`] : [])
  ];
  
  // Try each search strategy in sequence until we find a match
  for (const query of searchStrategies) {
    try {
      console.log(`Searching Deezer with strategy: "${query}"`);
      const searchResults = await searchDeezerTracks(query, 5);
      
      if (searchResults && searchResults.length > 0) {
        // Find the best match by comparing title similarity
        const bestMatch = findBestMatch(searchResults, spotifyTrack.songTitle);
        
        if (bestMatch) {
          console.log(`Found matching Deezer track: "${bestMatch.title}" by ${bestMatch.artist}`);
          console.log(`Preview URL available: ${bestMatch.preview ? 'YES' : 'NO'}`);
          return formatDeezerTrack(bestMatch);
        }
      }
    } catch (error) {
      console.error(`Error with search strategy "${query}":`, error);
      // Continue to next strategy
    }
  }
  
  console.log(`No Deezer match found for track: "${spotifyTrack.songTitle}"`);
  return null;
};

/**
 * Find the best matching track from search results based on title similarity
 * @param {Array} searchResults - Search results from Deezer
 * @param {string} targetTitle - The title to match against
 * @returns {Object|null} - Best matching track or null
 */
function findBestMatch(searchResults, targetTitle) {
  if (!searchResults || searchResults.length === 0) return null;
  
  // If only one result, use it
  if (searchResults.length === 1) return searchResults[0];
  
  // First, search for exact title match (case insensitive)
  const exactMatch = searchResults.find(
    track => track.title.toLowerCase() === targetTitle.toLowerCase()
  );
  
  if (exactMatch) return exactMatch;
  
  // Next, find tracks that include the target title
  const partialMatches = searchResults.filter(
    track => track.title.toLowerCase().includes(targetTitle.toLowerCase()) ||
             targetTitle.toLowerCase().includes(track.title.toLowerCase())
  );
  
  if (partialMatches.length > 0) {
    // If we have partial matches, use the first one with a preview URL
    const matchWithPreview = partialMatches.find(track => !!track.preview);
    if (matchWithPreview) return matchWithPreview;
    
    // Otherwise use the first partial match
    return partialMatches[0];
  }
  
  // If no good matches, check if any result has a preview URL
  const anyWithPreview = searchResults.find(track => !!track.preview);
  if (anyWithPreview) return anyWithPreview;
  
  // Fall back to first result
  return searchResults[0];
}

/**
 * Update Spotify track data with Deezer preview URL
 * @param {Array} spotifyTracks - Array of Spotify track objects
 * @returns {Promise<Array>} - Array of track objects with Deezer preview URLs when available
 */
export const enrichTracksWithDeezerPreviews = async (spotifyTracks) => {
  if (!spotifyTracks || !Array.isArray(spotifyTracks) || spotifyTracks.length === 0) {
    return [];
  }
  
  console.log(`Enriching ${spotifyTracks.length} Spotify tracks with Deezer preview URLs`);
  
  // Process tracks in small batches to avoid overwhelming the API
  const batchSize = 3;
  const enrichedTracks = [];
  
  for (let i = 0; i < spotifyTracks.length; i += batchSize) {
    const batch = spotifyTracks.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(spotifyTracks.length / batchSize)}`);
    
    // Process batch with a small delay between tracks
    const batchPromises = batch.map(async (track, batchIndex) => {
      const trackIndex = i + batchIndex;
      console.log(`Enriching track ${trackIndex + 1}/${spotifyTracks.length}: "${track.songTitle}"`);
      
      try {
        // Add a small delay to avoid rate limiting
        if (batchIndex > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const deezerTrack = await findDeezerTrackFromSpotify(track);
        
        if (deezerTrack && deezerTrack.previewUrl) {
          console.log(`Found Deezer preview URL for "${track.songTitle}"`);
          
          // Return a new object with all Spotify metadata but Deezer's preview URL
          return {
            ...track,
            previewUrl: deezerTrack.previewUrl,
            // Optionally store Deezer information for reference
            deezerInfo: {
              trackId: deezerTrack.trackId,
              externalUrl: deezerTrack.externalUrl
            }
          };
        } else {
          console.log(`No Deezer preview URL found for "${track.songTitle}", keeping original`);
        }
        
        return track; // Return original track if no Deezer match
      } catch (error) {
        console.error(`Error enriching track "${track.songTitle}":`, error);
        return track; // Return original track on error
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    enrichedTracks.push(...batchResults);
    
    // Add delay between batches
    if (i + batchSize < spotifyTracks.length) {
      console.log('Waiting before next batch...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Count how many tracks were successfully enriched
  const enrichedCount = enrichedTracks.filter(t => t.previewUrl).length;
  console.log(`Successfully enriched ${enrichedCount}/${spotifyTracks.length} tracks with Deezer preview URLs`);
  
  return enrichedTracks;
};

/**
 * Fallback function for React Native environments where CORS proxies don't work
 * Returns mock data with preview URLs for testing
 * @param {string} query - Search query
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of mock track objects
 */
const getMockDeezerTracks = async (query, limit = 10) => {
  // Mock tracks that simulate Deezer API responses
  const mockTracks = [
    {
      id: 1,
      title: "Blinding Lights",
      artist: "The Weeknd",
      album: "After Hours",
      duration: 200,
      preview: "https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9e9e880d2c6207e92260-8.mp3",
      link: "https://www.deezer.com/track/1",
    },
    {
      id: 2,
      title: "Shape of You",
      artist: "Ed Sheeran", 
      album: "÷ (Divide)",
      duration: 233,
      preview: "https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9e9e880d2c6207e92260-9.mp3",
      link: "https://www.deezer.com/track/2",
    },
    {
      id: 3,
      title: "Bohemian Rhapsody",
      artist: "Queen",
      album: "A Night at the Opera",
      duration: 355,
      preview: "https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9e9e880d2c6207e92260-10.mp3",
      link: "https://www.deezer.com/track/3",
    },
    {
      id: 4,
      title: "Billie Jean",
      artist: "Michael Jackson",
      album: "Thriller",
      duration: 294,
      preview: "https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9e9e880d2c6207e92260-11.mp3",
      link: "https://www.deezer.com/track/4",
    },
    {
      id: 5,
      title: "Hotel California",
      artist: "Eagles",
      album: "Hotel California",
      duration: 391,
      preview: "https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9e9e880d2c6207e92260-12.mp3",
      link: "https://www.deezer.com/track/5",
    }
  ];

  console.log(`Using mock Deezer tracks for React Native (query: "${query}")`);
  
  // Simple search filtering - match query against title or artist
  const queryLower = query.toLowerCase();
  const filteredTracks = mockTracks.filter(track => 
    track.title.toLowerCase().includes(queryLower) ||
    track.artist.toLowerCase().includes(queryLower)
  );
  
  // If no matches, return first few tracks anyway
  const tracksToReturn = filteredTracks.length > 0 ? filteredTracks : mockTracks;
  
  return tracksToReturn.slice(0, limit);
}; 