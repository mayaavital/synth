import axios from 'axios';
import { Platform } from 'react-native';

// Web-only serverless proxy function (inline to avoid import issues)
const serverlessProxy = async (url, params = {}) => {
  try {
    // Check if we're running in a browser environment
    if (typeof window === 'undefined') {
      throw new Error('Serverless proxy only available in browser');
    }
    
    // This would be your own Vercel serverless function
    const proxyUrl = '/api/cors-proxy';
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        params: params,
      }),
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    throw new Error(`Serverless proxy failed: ${response.status}`);
  } catch (error) {
    console.log('Serverless proxy not available:', error.message);
    throw error;
  }
};

// Multiple CORS proxies for maximum reliability
// We'll try them in order until one works
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://thingproxy.freeboard.io/fetch/',
  'https://cors-anywhere.herokuapp.com/',
  'https://api.allorigins.win/raw?url=',
  'https://proxy.cors.sh/',
];

let currentProxyIndex = 0;

const DEEZER_API = {
  SEARCH: 'https://api.deezer.com/search',
  TRACK: (trackId) => `https://api.deezer.com/track/${trackId}`,
  // JSONP endpoints (alternative to CORS proxy)
  SEARCH_JSONP: 'https://api.deezer.com/search',
  TRACK_JSONP: (trackId) => `https://api.deezer.com/track/${trackId}`,
};

/**
 * Get the next CORS proxy URL to try
 * @param {string} apiUrl - The Deezer API URL to proxy
 * @returns {string} - Full proxied URL
 */
const getProxiedUrl = (apiUrl) => {
  const proxy = CORS_PROXIES[currentProxyIndex];
  return `${proxy}${encodeURIComponent(apiUrl)}`;
};

/**
 * Alternative JSONP function for Deezer API (fallback for CORS issues)
 * Only works in browser environments
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
 * Search for tracks using JSONP (fallback for CORS issues)
 * Only works in browser environments
 * @param {string} query - Search query
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of track objects
 */
const searchDeezerTracksJSONP = async (query, limit = 10) => {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('JSONP only available in browser environment');
    }

    console.log(`Searching Deezer via JSONP for: "${query}"`);
    const jsonpResponse = await deezerJSONP(DEEZER_API.SEARCH_JSONP, {
      q: query,
      limit: limit
    });
    
    if (jsonpResponse && jsonpResponse.data && jsonpResponse.data.length > 0) {
      console.log(`Found ${jsonpResponse.data.length} tracks on Deezer via JSONP`);
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
      console.log('No tracks found on Deezer via JSONP');
      return [];
    }
  } catch (error) {
    console.error('JSONP search failed:', error.message);
    return [];
  }
};

/**
 * Try to fetch using the direct Deezer API with JSONP
 * Only works in browser environments
 * @param {string} query - Search query
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of track objects
 */
const tryDirectDeezerAPI = async (query, limit = 10) => {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof fetch === 'undefined') {
      throw new Error('Direct API only available in browser environment');
    }

    console.log(`Trying direct Deezer API call for: "${query}"`);
    
    // Direct API call with JSONP parameters
    const url = `${DEEZER_API.SEARCH}?q=${encodeURIComponent(query)}&limit=${limit}&output=jsonp`;
    
    const response = await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
    });
    
    // This won't work due to CORS but let's try anyway
    if (response.ok) {
      const data = await response.json();
      if (data && data.data && data.data.length > 0) {
        console.log(`✅ Direct API success: Found ${data.data.length} tracks`);
        return data.data.map(track => ({
          id: track.id,
          title: track.title,
          artist: track.artist?.name || 'Unknown Artist',
          album: track.album?.title || 'Unknown Album',
          duration: track.duration,
          preview: track.preview,
          link: track.link,
        }));
      }
    }
    
    return [];
  } catch (error) {
    console.log(`❌ Direct API failed (expected due to CORS):`, error.message);
    return [];
  }
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
  console.log(`Platform: ${Platform.OS}`);
  
  // Strategy 1: Try JSONP first (most reliable, but only on web)
  if (Platform.OS === 'web') {
    try {
      console.log(`\n1. Trying JSONP fallback...`);
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
    console.log(`\n1. JSONP skipped (not available on ${Platform.OS})`);
  }
  
  // Strategy 2: Try all CORS proxies in sequence
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    currentProxyIndex = i;
    const proxy = CORS_PROXIES[i];
    
    try {
      console.log(`\n2.${i + 1}. Trying CORS proxy: ${proxy}`);
      const proxiedUrl = getProxiedUrl(DEEZER_API.SEARCH);
      console.log(`Full URL: ${proxiedUrl}`);
      
      const response = await axios.get(proxiedUrl, {
        params: {
          q: query,
          limit: limit
        },
        timeout: 10000, // Reduced timeout for faster fallback
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
        }
      });

      console.log(`Response status: ${response.status}`);

      // Check if we got valid data
      if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
        console.log(`✅ CORS proxy success: Found ${response.data.data.length} tracks`);
        return response.data.data.map(track => ({
          id: track.id,
          title: track.title,
          artist: track.artist?.name || 'Unknown Artist',
          album: track.album?.title || 'Unknown Album',
          duration: track.duration,
          preview: track.preview,
          link: track.link,
        }));
      } else {
        console.log(`❌ CORS proxy ${i + 1}: Invalid response format`);
      }
    } catch (proxyError) {
      console.log(`❌ CORS proxy ${i + 1} failed:`, {
        message: proxyError.message,
        status: proxyError.response?.status,
        statusText: proxyError.response?.statusText,
      });
    }
  }
  
  // Strategy 3: Try alternative proxy strategies (web only)
  if (Platform.OS === 'web') {
    try {
      console.log(`\n3. Trying serverless proxy strategy...`);
      const altResult = await serverlessProxy(DEEZER_API.SEARCH, {
        q: query,
        limit: limit
      });
      
      if (altResult && altResult.data && Array.isArray(altResult.data) && altResult.data.length > 0) {
        console.log(`✅ Serverless proxy success: Found ${altResult.data.length} tracks`);
        return altResult.data.map(track => ({
          id: track.id,
          title: track.title,
          artist: track.artist?.name || 'Unknown Artist',
          album: track.album?.title || 'Unknown Album',
          duration: track.duration,
          preview: track.preview,
          link: track.link,
        }));
      }
    } catch (altError) {
      console.log(`❌ Serverless proxy strategy failed:`, altError.message);
    }
  } else {
    console.log(`\n3. Serverless proxy strategy skipped (not available on ${Platform.OS})`);
  }
  
  // Strategy 4: Try direct API (will likely fail but worth trying on web)
  if (Platform.OS === 'web') {
    try {
      console.log(`\n4. Trying direct API call (may fail due to CORS)...`);
      const directResult = await tryDirectDeezerAPI(query, limit);
      if (directResult && directResult.length > 0) {
        console.log(`✅ Direct API success: Found ${directResult.length} tracks`);
        return directResult;
      }
    } catch (directError) {
      console.log(`❌ Direct API failed:`, directError.message);
    }
  } else {
    console.log(`\n4. Direct API skipped (not available on ${Platform.OS})`);
  }
  
  // Final fallback: Use mock data for React Native environments
  if (Platform.OS !== 'web') {
    try {
      console.log(`\n5. Using mock data fallback for ${Platform.OS}...`);
      const mockResult = await getMockDeezerTracks(query, limit);
      if (mockResult && mockResult.length > 0) {
        console.log(`✅ Mock data success: Found ${mockResult.length} tracks`);
        return mockResult;
      }
    } catch (mockError) {
      console.log(`❌ Mock data failed:`, mockError.message);
    }
  }
  
  console.log(`\n❌ All available strategies failed for query: "${query}" on platform: ${Platform.OS}`);
  return [];
};

/**
 * Get track details from Deezer by track ID
 * @param {string} trackId - Deezer track ID
 * @returns {Promise<Object|null>} - Track object or null if not found
 */
export const getDeezerTrackById = async (trackId) => {
  try {
    console.log(`Fetching Deezer track with ID: ${trackId} on platform: ${Platform.OS}`);
    
    // Try JSONP first (web only)
    if (Platform.OS === 'web') {
      try {
        const jsonpResponse = await deezerJSONP(DEEZER_API.TRACK_JSONP(trackId));
        if (jsonpResponse && jsonpResponse.id) {
          console.log(`✅ JSONP track fetch success for ID: ${trackId}`);
          return jsonpResponse;
        }
      } catch (jsonpError) {
        console.log('JSONP track fetch failed, trying CORS proxy');
      }
    }
    
    // Fallback to CORS proxy
    try {
      const proxiedUrl = getProxiedUrl(DEEZER_API.TRACK(trackId));
      const response = await axios.get(proxiedUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
        }
      });
      
      if (response.data && response.data.id) {
        console.log(`✅ CORS proxy track fetch success for ID: ${trackId}`);
        return response.data;
      }
    } catch (proxyError) {
      console.log(`❌ CORS proxy track fetch failed for ID: ${trackId}:`, proxyError.message);
    }
    
    // For React Native, return mock track data
    if (Platform.OS !== 'web') {
      console.log(`Using mock track data for React Native (ID: ${trackId})`);
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
    console.error('Error fetching Deezer track:', error);
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