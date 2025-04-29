import axios from 'axios';

// Deezer API endpoints
const DEEZER_API = {
  SEARCH: 'https://api.deezer.com/search',
  TRACK: (trackId) => `https://api.deezer.com/track/${trackId}`,
};

/**
 * Search for tracks on Deezer by query
 * @param {string} query - Search query (e.g. "artist name song title")
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of track objects
 */
export const searchDeezerTracks = async (query, limit = 10) => {
  try {
    console.log(`Searching Deezer for: "${query}"`);
    const response = await axios.get(DEEZER_API.SEARCH, {
      params: {
        q: query,
        limit: limit
      }
    });

    if (response.data && response.data.data && response.data.data.length > 0) {
      console.log(`Found ${response.data.data.length} tracks on Deezer`);
      return response.data.data;
    } else {
      console.log('No tracks found on Deezer');
      return [];
    }
  } catch (error) {
    console.error('Error searching Deezer:', error);
    return [];
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
  
  // Create a search query using song title and first artist
  const artistName = spotifyTrack.songArtists && spotifyTrack.songArtists.length > 0 
    ? spotifyTrack.songArtists[0] 
    : '';
  
  const query = `${spotifyTrack.songTitle} ${artistName}`.trim();
  console.log(`Searching Deezer for Spotify track: "${query}"`);
  
  try {
    const searchResults = await searchDeezerTracks(query, 5);
    
    if (searchResults && searchResults.length > 0) {
      // First match is usually most relevant with Deezer search
      const bestMatch = searchResults[0];
      console.log(`Found matching Deezer track: "${bestMatch.title}" by ${bestMatch.artist.name}`);
      return formatDeezerTrack(bestMatch);
    }
    
    return null;
  } catch (error) {
    console.error('Error finding Deezer track from Spotify:', error);
    return null;
  }
};

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
  const enrichedTracks = [];
  
  // Process tracks in parallel with Promise.all
  const enrichPromises = spotifyTracks.map(async (track) => {
    // If track already has a valid preview URL, keep it as is
    if (track.previewUrl) {
      return track;
    }
    
    try {
      const deezerTrack = await findDeezerTrackFromSpotify(track);
      
      if (deezerTrack && deezerTrack.previewUrl) {
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