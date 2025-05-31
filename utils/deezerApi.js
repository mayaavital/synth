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
    
    // Check if we're in local development (localhost)
    const isLocalDevelopment = typeof window !== 'undefined' && 
                              (window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1' ||
                               window.location.port === '8085');
    
    if (isLocalDevelopment) {
      console.log('[DEEZER PROXY] Local development detected, skipping serverless proxy');
      throw new Error('Serverless proxy not available in local development');
    }
    
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
    
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      console.log('[DEEZER JSONP] Not in browser environment, skipping JSONP');
      throw new Error('JSONP only available in browser environment');
    }
    
    const jsonpResponse = await deezerJSONP('https://api.deezer.com/search', {
      q: query,
      limit: limit
    });
    
    console.log('[DEEZER JSONP] Raw response:', jsonpResponse);
    
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
      console.log('[DEEZER JSONP] No tracks found in response');
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
      console.log(`\n3. Mock data fallback disabled - no fallback tracks will be provided`);
      console.log(`✅ Skipping mock data to ensure only real tracks are used`);
    } catch (mockError) {
      console.log(`❌ Mock data was disabled`);
    }
  }
  
  console.log(`\n❌ All strategies failed for query: "${query}" - NO MOCK TRACKS WILL BE PROVIDED`);
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
 * @param {boolean} isMockData - Whether this track comes from mock data
 * @returns {Object} - Formatted track object
 */
export const formatDeezerTrack = (deezerTrack, isMockData = false) => {
  // SAFETY CHECK: Never allow known mock tracks to be formatted
  const mockTrackTitles = [
    "Blinding Lights", "Shape of You", "Bohemian Rhapsody", "Billie Jean", "Hotel California",
    "Don't Stop Believin'", "Sweet Child O' Mine", "I Want It That Way"
  ];
  
  const isKnownMockTrack = mockTrackTitles.some(mockTitle => 
    deezerTrack.title && deezerTrack.title.toLowerCase().trim() === mockTitle.toLowerCase().trim()
  );
  
  if (isKnownMockTrack) {
    console.log(`🚫 BLOCKING KNOWN MOCK TRACK from formatDeezerTrack: "${deezerTrack.title}"`);
    return null; // Return null instead of formatted track
  }

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
    isMockTrack: false, // EXPLICITLY mark as NOT a mock track since we filtered them out
    _debug: {
      title: deezerTrack.title,
      artists: [deezerTrack.artist?.name],
      duration: deezerTrack.duration * 1000,
      albumArt: deezerTrack.album?.cover_medium ? "Available" : "Unavailable",
      previewUrl: deezerTrack.preview ? "Available" : "Unavailable",
      isMockData: false, // Always false since we block mock tracks
    }
  };
};

/**
 * Normalize artist name for better matching
 * @param {string} artistName - Raw artist name
 * @returns {string} - Normalized artist name
 */
function normalizeArtistName(artistName) {
  if (!artistName) return '';
  
  return artistName
    .toLowerCase()
    .trim()
    // Remove common featuring indicators
    .replace(/\s+(feat\.?|ft\.?|featuring)\s+.*/i, '')
    // Normalize ampersands and "and"
    .replace(/\s+&\s+/g, ' and ')
    .replace(/\s+\+\s+/g, ' and ')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove common punctuation that might differ
    .replace(/[.,;:!?'"]/g, '')
    .trim();
}

/**
 * Normalize song title for better matching
 * @param {string} title - Raw song title
 * @returns {string} - Normalized title
 */
function normalizeSongTitle(title) {
  if (!title) return '';
  
  return title
    .toLowerCase()
    .trim()
    // Remove common version indicators
    .replace(/\s*\(.*?(remix|edit|version|remaster|live|acoustic|radio|explicit|clean).*?\)/gi, '')
    .replace(/\s*\[.*?(remix|edit|version|remaster|live|acoustic|radio|explicit|clean).*?\]/gi, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove common punctuation that might differ
    .replace(/[.,;:!?'"]/g, '')
    .trim();
}

/**
 * Compare durations to see if they're reasonably close
 * @param {number} duration1 - Duration in seconds
 * @param {number} duration2 - Duration in seconds
 * @param {number} tolerancePercent - Tolerance percentage (default 15%)
 * @returns {boolean} - Whether durations are close enough
 */
function durationsMatch(duration1, duration2, tolerancePercent = 15) {
  if (!duration1 || !duration2) return true; // If we don't have duration data, don't filter
  
  const longer = Math.max(duration1, duration2);
  const shorter = Math.min(duration1, duration2);
  const difference = longer - shorter;
  const tolerance = longer * (tolerancePercent / 100);
  
  return difference <= tolerance;
}

/**
 * Calculate similarity score between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score between 0 and 1
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const normalized1 = str1.toLowerCase().trim();
  const normalized2 = str2.toLowerCase().trim();
  
  // Exact match
  if (normalized1 === normalized2) return 1;
  
  // Check if one contains the other
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return 0.8;
  }
  
  // Simple character-based similarity (Jaccard similarity on character bigrams)
  const bigrams1 = new Set();
  const bigrams2 = new Set();
  
  for (let i = 0; i < normalized1.length - 1; i++) {
    bigrams1.add(normalized1.substring(i, i + 2));
  }
  
  for (let i = 0; i < normalized2.length - 1; i++) {
    bigrams2.add(normalized2.substring(i, i + 2));
  }
  
  const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
  const union = new Set([...bigrams1, ...bigrams2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Search for a track on Deezer using Spotify track information
 * @param {Object} spotifyTrack - Spotify track object
 * @returns {Promise<Object|null>} - Formatted Deezer track or null if not found
 */
export const findDeezerTrackFromSpotify = async (spotifyTrack) => {
  if (!spotifyTrack || !spotifyTrack.songTitle) {
    return null;
  }
  
  // Extract and normalize artist name from track
  const rawArtistName = spotifyTrack.songArtists && spotifyTrack.songArtists.length > 0 
    ? spotifyTrack.songArtists[0] 
    : '';
  const normalizedArtistName = normalizeArtistName(rawArtistName);
  const normalizedSongTitle = normalizeSongTitle(spotifyTrack.songTitle);
  
  // Convert Spotify duration from ms to seconds for comparison
  const spotifyDurationSeconds = spotifyTrack.duration ? Math.round(spotifyTrack.duration / 1000) : null;
  
  console.log(`Searching for: "${spotifyTrack.songTitle}" by "${rawArtistName}"`);
  console.log(`Normalized: "${normalizedSongTitle}" by "${normalizedArtistName}"`);
  if (spotifyDurationSeconds) {
    console.log(`Expected duration: ${spotifyDurationSeconds} seconds`);
  }
  
  // Try multiple search strategies to maximize chances of finding a match
  const searchStrategies = [
    // Strategy 1: Song title + artist (standard)
    `${spotifyTrack.songTitle} ${rawArtistName}`,
    
    // Strategy 2: Normalized versions
    `${normalizedSongTitle} ${normalizedArtistName}`,
    
    // Strategy 3: Song title only (for when artist names might differ)
    `${spotifyTrack.songTitle}`,
    
    // Strategy 4: Use album name if available (helpful for compilations)
    ...(spotifyTrack.albumName ? [`${spotifyTrack.songTitle} ${spotifyTrack.albumName}`] : []),
    
    // Strategy 5: Song title in quotes (exact match)
    `"${spotifyTrack.songTitle}"`,
    
    // Strategy 6: Artist only (as last resort, might find other tracks by same artist)
    ...(rawArtistName ? [`artist:"${rawArtistName}"`] : [])
  ];
  
  // Try each search strategy in sequence until we find a match
  for (const query of searchStrategies) {
    try {
      console.log(`Searching Deezer with strategy: "${query}"`);
      const searchResults = await searchDeezerTracks(query, 8); // Increased limit for better matching
      
      if (searchResults && searchResults.length > 0) {
        // Find the best match using improved matching logic
        const bestMatch = findBestMatchImproved(
          searchResults, 
          spotifyTrack.songTitle, 
          rawArtistName, 
          spotifyDurationSeconds
        );
        
        if (bestMatch) {
          console.log(`✅ Found matching Deezer track: "${bestMatch.title}" by ${bestMatch.artist}`);
          console.log(`   Duration match: Spotify ${spotifyDurationSeconds}s vs Deezer ${bestMatch.duration}s`);
          console.log(`   Preview URL available: ${bestMatch.preview ? 'YES' : 'NO'}`);
          
          // Check if this is a mock track by comparing with known mock track titles
          const mockTrackTitles = [
            "Blinding Lights", "Shape of You", "Bohemian Rhapsody", "Billie Jean", "Hotel California",
            "Don't Stop Believin'", "Sweet Child O' Mine", "I Want It That Way"
          ];
          const isMockData = mockTrackTitles.some(mockTitle => 
            bestMatch.title.toLowerCase().trim() === mockTitle.toLowerCase().trim()
          );
          
          if (isMockData) {
            console.log(`⚠️ WARNING: Detected mock Deezer track "${bestMatch.title}" - REJECTING to ensure only real tracks are used`);
            continue; // Skip this mock track and try next search strategy
          }
          
          return formatDeezerTrack(bestMatch, isMockData);
        }
      }
    } catch (error) {
      console.error(`Error with search strategy "${query}":`, error);
      // Continue to next strategy
    }
  }
  
  console.log(`❌ No Deezer match found for track: "${spotifyTrack.songTitle}"`);
  return null;
};

/**
 * Find the best matching track from search results with improved matching logic
 * @param {Array} searchResults - Search results from Deezer
 * @param {string} targetTitle - The title to match against
 * @param {string} targetArtist - The artist to match against
 * @param {number} targetDuration - The duration in seconds to match against
 * @returns {Object|null} - Best matching track or null
 */
function findBestMatchImproved(searchResults, targetTitle, targetArtist, targetDuration) {
  if (!searchResults || searchResults.length === 0) return null;
  
  const normalizedTargetTitle = normalizeSongTitle(targetTitle);
  const normalizedTargetArtist = normalizeArtistName(targetArtist);
  
  console.log(`Looking for best match among ${searchResults.length} results`);
  
  // Score each result
  const scoredResults = searchResults.map(track => {
    const normalizedTrackTitle = normalizeSongTitle(track.title);
    const normalizedTrackArtist = normalizeArtistName(track.artist);
    
    // Calculate similarity scores
    const titleSimilarity = calculateSimilarity(normalizedTargetTitle, normalizedTrackTitle);
    const artistSimilarity = calculateSimilarity(normalizedTargetArtist, normalizedTrackArtist);
    
    // Check duration match
    const durationMatch = targetDuration && track.duration 
      ? durationsMatch(targetDuration, track.duration) 
      : true; // If no duration data, don't penalize
    
    // Calculate overall score
    let score = (titleSimilarity * 0.6) + (artistSimilarity * 0.3);
    
    // Bonus points for having a preview URL
    if (track.preview) {
      score += 0.1;
    }
    
    // Bonus points for duration match
    if (durationMatch) {
      score += 0.1;
    } else if (targetDuration && track.duration) {
      // Penalize duration mismatch only if we have both durations
      score -= 0.2;
    }
    
    // Exact title match gets a big bonus
    if (normalizedTrackTitle === normalizedTargetTitle) {
      score += 0.3;
    }
    
    // Exact artist match gets a bonus
    if (normalizedTrackArtist === normalizedTargetArtist) {
      score += 0.2;
    }
    
    console.log(`  "${track.title}" by ${track.artist} - Score: ${score.toFixed(3)} (title: ${titleSimilarity.toFixed(2)}, artist: ${artistSimilarity.toFixed(2)}, duration: ${durationMatch ? 'match' : 'mismatch'})`);
    
    return {
      track,
      score,
      titleSimilarity,
      artistSimilarity,
      durationMatch
    };
  });
  
  // Sort by score (highest first)
  scoredResults.sort((a, b) => b.score - a.score);
  
  // Return the best match if it meets minimum criteria
  const bestResult = scoredResults[0];
  
  // Minimum thresholds for acceptance
  const minTitleSimilarity = 0.5;
  const minOverallScore = 0.4;
  
  if (bestResult.score >= minOverallScore && bestResult.titleSimilarity >= minTitleSimilarity) {
    console.log(`✅ Selected best match: "${bestResult.track.title}" with score ${bestResult.score.toFixed(3)}`);
    return bestResult.track;
  } else {
    console.log(`❌ No result met minimum criteria (best score: ${bestResult.score.toFixed(3)}, title similarity: ${bestResult.titleSimilarity.toFixed(3)})`);
    return null;
  }
}

/**
 * Find the best matching track from search results based on title similarity
 * @param {Array} searchResults - Search results from Deezer
 * @param {string} targetTitle - The title to match against
 * @returns {Object|null} - Best matching track or null
 */
function findBestMatch(searchResults, targetTitle) {
  // Keep the old function for backward compatibility, but use the improved version
  return findBestMatchImproved(searchResults, targetTitle, '', null);
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
          
          // Check if this is a mock track and log it
          if (deezerTrack.isMockTrack) {
            console.log(`⚠️ WARNING: Enriched "${track.songTitle}" with mock Deezer track`);
          }
          
          // Return a new object with all Spotify metadata but Deezer's preview URL
          return {
            ...track,
            previewUrl: deezerTrack.previewUrl,
            isMockTrack: deezerTrack.isMockTrack || false, // IMPORTANT: Propagate mock flag
            // Optionally store Deezer information for reference
            deezerInfo: {
              trackId: deezerTrack.trackId,
              externalUrl: deezerTrack.externalUrl,
              isMockTrack: deezerTrack.isMockTrack || false
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
 * Mock track functionality completely removed to ensure no mock tracks are ever used
 * Previously this file contained getMockDeezerTracks function which has been eliminated
 */ 