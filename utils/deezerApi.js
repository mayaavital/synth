import axios from 'axios';

// Deezer API endpoints with CORS proxy for web compatibility
// Alternative CORS proxies in case one fails:
// 1. https://corsproxy.io/?
// 2. https://cors-anywhere.herokuapp.com/ (requires request)
// 3. https://api.allorigins.win/raw?url=
// 4. https://proxy.cors.sh/ (newer option)

const CORS_PROXY = 'https://corsproxy.io/?';
// Alternative proxies (uncomment to try if current one fails):
// const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
// const CORS_PROXY = 'https://proxy.cors.sh/';
// const CORS_PROXY = ''; // Remove proxy entirely to test direct access

const DEEZER_API = {
  SEARCH: `${CORS_PROXY}https://api.deezer.com/search`,
  TRACK: (trackId) => `${CORS_PROXY}https://api.deezer.com/track/${trackId}`,
  // JSONP endpoints (alternative to CORS proxy)
  SEARCH_JSONP: 'https://api.deezer.com/search',
  TRACK_JSONP: (trackId) => `https://api.deezer.com/track/${trackId}`,
};

/**
 * Alternative JSONP function for Deezer API (fallback for CORS issues)
 * @param {string} url - The API URL
 * @param {Object} params - Query parameters
 * @returns {Promise} - Promise that resolves with API response
 */
const deezerJSONP = (url, params = {}) => {
  return new Promise((resolve, reject) => {
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
      document.head.removeChild(script);
      delete window[callbackName];
      resolve(data);
    };
    
    // Handle errors
    script.onerror = () => {
      document.head.removeChild(script);
      delete window[callbackName];
      reject(new Error('JSONP request failed'));
    };
    
    // Add script to page
    document.head.appendChild(script);
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (window[callbackName]) {
        document.head.removeChild(script);
        delete window[callbackName];
        reject(new Error('JSONP request timeout'));
      }
    }, 10000);
  });
};

/**
 * Search for tracks on Deezer by query
 * @param {string} query - Search query (e.g. "artist name song title")
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of track objects
 */
export const searchDeezerTracks = async (query, limit = 10) => {
  // First try with CORS proxy
  try {
    console.log(`Searching Deezer for: "${query}"`);
    console.log(`Using CORS proxy: ${CORS_PROXY}`);
    
    const response = await axios.get(DEEZER_API.SEARCH, {
      params: {
        q: query,
        limit: limit
      },
      timeout: 10000, // 10 second timeout
    });

    if (response.data && response.data.data && response.data.data.length > 0) {
      console.log(`Found ${response.data.data.length} tracks on Deezer via CORS proxy`);
      return response.data.data;
    } else {
      console.log('No tracks found on Deezer via CORS proxy');
      return [];
    }
  } catch (error) {
    console.error('CORS proxy failed, trying JSONP fallback:', error);
    
    // Provide specific error messaging for common issues
    if (error.code === 'ERR_NETWORK') {
      console.error('CORS/Network error detected. Falling back to JSONP...');
    }
    
    // Try JSONP fallback
    try {
      console.log('Attempting Deezer search with JSONP fallback...');
      const jsonpResponse = await deezerJSONP(DEEZER_API.SEARCH_JSONP, {
        q: query,
        limit: limit
      });
      
      if (jsonpResponse && jsonpResponse.data && jsonpResponse.data.length > 0) {
        console.log(`Found ${jsonpResponse.data.length} tracks on Deezer via JSONP`);
        return jsonpResponse.data;
      } else {
        console.log('No tracks found on Deezer via JSONP');
        return [];
      }
    } catch (jsonpError) {
      console.error('JSONP fallback also failed:', jsonpError);
      return [];
    }
  }
};

/**
 * Get track details from Deezer by track ID
 * @param {string} trackId - Deezer track ID
 * @returns {Promise<Object|null>} - Track object or null if not found
 */
export const getDeezerTrackById = async (trackId) => {
  try {
    console.log(`Fetching Deezer track with ID: ${trackId}`);
    const response = await axios.get(DEEZER_API.TRACK(trackId));
    return response.data;
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
          console.log(`Found matching Deezer track: "${bestMatch.title}" by ${bestMatch.artist.name}`);
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
  
  // Process tracks in parallel with Promise.all
  const enrichPromises = spotifyTracks.map(async (track, index) => {
    // Always attempt to find a Deezer preview URL, even if one already exists
    // This ensures we have the best possible preview URLs
    console.log(`Enriching track ${index + 1}/${spotifyTracks.length}: "${track.songTitle}"`);
    
    try {
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
  
  const results = await Promise.all(enrichPromises);
  
  // Count how many tracks were successfully enriched
  const enrichedCount = results.filter(t => t.previewUrl).length;
  console.log(`Successfully enriched ${enrichedCount}/${spotifyTracks.length} tracks with Deezer preview URLs`);
  
  return results;
}; 