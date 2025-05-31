import axios from "axios";
import getEnv from "./env";

const {
  SPOTIFY_API: { TOP_TRACKS_API, ALBUM_TRACK_API_GETTER, TRACK_API_GETTER },
} = getEnv();

// Verify the API configuration
console.log("API Configuration check:", {
  hasTopTracksAPI: !!TOP_TRACKS_API,
  hasAlbumTrackAPI: typeof ALBUM_TRACK_API_GETTER === 'function',
  hasTrackAPI: typeof TRACK_API_GETTER === 'function'
});

// Add Spotify Recently Played API endpoint
const RECENTLY_PLAYED_API = "https://api.spotify.com/v1/me/player/recently-played?limit=50";

const ERROR_ALERT = new Error(
  "Oh no! Something went wrong; probably a malformed request or a network error.\nCheck console for more details."
);

/* Pulls out the relevant data from the API response and puts it in a nicely structured object. */
const formatter = (data) => {
  if (!data || !Array.isArray(data)) {
    console.error("Invalid data passed to formatter:", data);
    return [];
  }
  
  console.log(`Formatting ${data.length} tracks`);
  
  return data.map((val, index) => {
    if (index === 0) {
      console.log("=== FORMATTING DEBUG ===");
      console.log("Fields available:", Object.keys(val));
      console.log("Has 'preview_url':", val.hasOwnProperty('preview_url'));
      console.log("Has 'external_urls':", val.hasOwnProperty('external_urls'));
      console.log("Sample external_urls:", val.external_urls);
    }
    
    const artists = val.artists?.map((artist) => ({ name: artist.name }));
    
    // Find preview URL - check multiple possible locations
    const previewUrl = val.preview_url || 
                      val.external_preview_url || 
                      val.external_urls?.preview ||
                      null;
    
    if (index === 0) {
      console.log("Found preview URL:", previewUrl);
    }
                      
    // returning undefined for now to not confuse students, ideally a fix would be a hosted version of this
    return {
      songTitle: val.name,
      songArtists: artists.map(artist => artist.name),
      albumName: val.album?.name,
      imageUrl: val.album?.images[0]?.url ?? undefined,
      duration: val.duration_ms,
      externalUrl: val.external_urls?.spotify ?? undefined,
      previewUrl: previewUrl,
      // Add additional fields required by the specifications
      uri: val.uri ?? undefined,
      // Including additional useful fields
      trackId: val.id ?? undefined,
      popularity: val.popularity ?? undefined,
      albumReleaseDate: val.album?.release_date ?? undefined,
      _originalData: (index === 0) ? val : undefined,  // Include original data for the first track only
    };
  });
};

/* Fetches data from the given endpoint URL with the access token provided. */
const fetcher = async (url, token) => {
  if (!token) {
    console.error("No token provided to fetcher!");
    throw new Error("No authentication token provided");
  }
  
  try {
    console.log(`Making API request to: ${url}`);
    console.log(`With token (first 10 chars): ${token.substring(0, 10)}...`);
    
    const startTime = Date.now();
    const response = await axios(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    });
    const endTime = Date.now();
    
    console.log(`API request completed in ${endTime - startTime}ms`);
    console.log(`Response status: ${response.status}`);
    
    if (response.data) {
      console.log("Response contains data");
      if (response.data.items) {
        console.log(`Response contains ${response.data.items.length} items`);
      }
    } else {
      console.warn("Response does not contain data");
    }
    
    return response;
  } catch (error) {
    console.log("Fetcher error: ", error);
    console.log("Error details:", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    throw error; // Rethrow to handle in the calling function
  }
};

/* Fetches your top tracks from the Spotify API.
 * Make sure that TOP_TRACKS_API is set correctly in env.js */
export const getMyTopTracks = async (token) => {
  try {
    let res = await fetcher(TOP_TRACKS_API, token);
    return formatter(res.data?.items);
  } catch (e) {
    console.error("Error in getMyTopTracks:", e);
    
    // Don't show alert directly, let the caller handle the error
    if (e.response?.status === 401) {
      throw e; // Allow 401 errors to bubble up for token refresh handling
    }
    
    return null;
  }
};

/* Fetches the given album from the Spotify API.
 * Make sure that ALBUM_TRACK_API_GETTER is set correctly in env.js */
export const getAlbumTracks = async (albumId, token) => {
  try {
    console.log("ALBUM_TRACK_ID", ALBUM_TRACK_API_GETTER(albumId));
    const res = await fetcher(ALBUM_TRACK_API_GETTER(albumId), token);
    
    // Log raw album data for debugging
    console.log("=== RAW ALBUM API RESPONSE ===");
    console.log("Album name:", res.data?.name);
    console.log("Total tracks:", res.data?.total_tracks || res.data?.tracks?.total || 0);
    
    // Log example track to check structure
    if (res.data?.tracks?.items?.length > 0) {
      console.log("=== EXAMPLE TRACK STRUCTURE ===");
      const exampleTrack = res.data.tracks.items[0];
      // Convert to JSON and back to get a clean object for logging
      const cleanExample = JSON.parse(JSON.stringify(exampleTrack));
      console.log("Track fields:", Object.keys(cleanExample));
      console.log("Has preview_url:", exampleTrack.hasOwnProperty('preview_url'));
      console.log("preview_url value:", exampleTrack.preview_url);
      console.log("First track:", cleanExample);
    }
    
    const transformedResponse = res.data?.tracks?.items?.map((item) => {
      item.album = { images: res.data?.images, name: res.data?.name };
      return item;
    });
    return formatter(transformedResponse);
  } catch (e) {
    console.error("Error in getAlbumTracks:", e);
    
    // Don't show alert directly, let the caller handle the error
    if (e.response?.status === 401) {
      throw e; // Allow 401 errors to bubble up for token refresh handling
    }
    
    return null;
  }
};

/* Fetches your recently played tracks from the Spotify API. */
export const getMyRecentlyPlayedTracks = async (token) => {
  try {
    console.log("Starting API call to recently played tracks endpoint");
    console.log("Using token (first 10 chars):", token ? token.substring(0, 10) + "..." : "No token");
    console.log("API URL:", RECENTLY_PLAYED_API);
    
    const res = await fetcher(RECENTLY_PLAYED_API, token);
    console.log("API response received:", res ? "Success" : "No response");
    
    // The recently played API returns a different format than the top tracks API
    // We need to extract the track from each item
    const items = res.data?.items;
    console.log("Items in response:", items?.length || 0);
    
    const tracks = items?.map(item => item.track);
    
    if (!tracks || tracks.length === 0) {
      console.warn("No recently played tracks found");
      return [];
    }
    
    console.log("Formatting tracks...");
    const formattedTracks = formatter(tracks);
    console.log("Tracks formatted, returning data");
    
    return formattedTracks;
  } catch (e) {
    console.error("Error fetching recently played tracks:", e);
    console.error("Error details:", JSON.stringify({
      message: e.message,
      response: e.response ? {
        status: e.response.status,
        statusText: e.response.statusText,
        data: e.response.data
      } : "No response object"
    }, null, 2));
    
    // Don't show alert directly, let the caller handle the error
    if (e.response?.status === 401) {
      console.log("Throwing 401 error for token refresh");
      throw e; // Allow 401 errors to bubble up for token refresh handling
    }
    
    return null;
  }
};

/* Fetches details for a specific track */
export const getTrackDetails = async (trackId, token) => {
  try {
    console.log("Fetching track details for ID:", trackId);
    
    // Check if TRACK_API_GETTER is available
    if (typeof TRACK_API_GETTER !== 'function') {
      console.error("TRACK_API_GETTER is not properly defined in env.js");
      
      // Direct fallback URL construction
      const trackUrl = `https://api.spotify.com/v1/tracks/${trackId}`;
      console.log("Using direct URL instead:", trackUrl);
      
      const res = await fetcher(trackUrl, token);
      
      // Log raw track data for debugging
      console.log("=== TRACK API RESPONSE ===");
      console.log("Track name:", res.data?.name);
      console.log("Has preview_url:", res.data?.hasOwnProperty('preview_url'));
      console.log("Preview URL value:", res.data?.preview_url);
      
      // Return formatted track data
      return formatter([res.data])[0];
    }
    
    const trackUrl = TRACK_API_GETTER(trackId);
    console.log("Track API URL:", trackUrl);
    
    const res = await fetcher(trackUrl, token);
    
    // Log raw track data for debugging
    console.log("=== TRACK API RESPONSE ===");
    console.log("Track name:", res.data?.name);
    console.log("Has preview_url:", res.data?.hasOwnProperty('preview_url'));
    console.log("Preview URL value:", res.data?.preview_url);
    
    // Return formatted track data
    return formatter([res.data])[0];
  } catch (e) {
    console.error("Error in getTrackDetails:", e);
    
    if (e.response?.status === 401) {
      throw e; // Allow 401 errors to bubble up for token refresh handling
    }
    
    return null;
  }
};

// Add this new function to get user profile
export const getSpotifyUserProfile = async (token) => {
  try {
    const response = await fetch(`https://api.spotify.com/v1/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message || 'Failed to fetch user profile');
    }

    const data = await response.json();
    
    // Return formatted profile data
    return {
      id: data.id,
      displayName: data.display_name || data.id,
      profilePicture: data.images && data.images.length > 0 ? data.images[0].url : null,
      email: data.email,
      spotifyUri: data.uri,
      country: data.country,
      product: data.product  // premium, free, etc.
    };
  } catch (error) {
    console.error('Error fetching Spotify user profile:', error);
    return null;
  }
};

/* Fetches your saved albums from the Spotify API. */
export const getMySavedAlbums = async (token, limit = 20) => {
  try {
    const url = `https://api.spotify.com/v1/me/albums?limit=${limit}`;
    console.log("Fetching saved albums from:", url);
    
    const res = await fetcher(url, token);
    console.log("Saved albums response received");
    
    const albums = res.data?.items?.map(item => ({
      albumName: item.album?.name,
      artistName: item.album?.artists?.[0]?.name,
      imageUrl: item.album?.images?.[0]?.url,
      externalUrl: item.album?.external_urls?.spotify,
      albumId: item.album?.id,
      totalTracks: item.album?.total_tracks,
      releaseDate: item.album?.release_date,
    }));
    
    console.log(`Formatted ${albums?.length || 0} saved albums`);
    return albums || [];
  } catch (e) {
    console.error("Error in getMySavedAlbums:", e);
    
    if (e.response?.status === 401) {
      throw e;
    }
    
    return [];
  }
};

/* Fetches recommendations from Spotify based on seed tracks */
export const getSpotifyRecommendations = async (token, seedTracks, options = {}) => {
  try {
    // Validate inputs
    if (!seedTracks || seedTracks.length === 0) {
      throw new Error("At least one seed track is required");
    }
    
    if (seedTracks.length > 5) {
      console.warn("Spotify allows max 5 seed tracks, using first 5");
      seedTracks = seedTracks.slice(0, 5);
    }
    
    // Build the URL with seed tracks
    const baseUrl = "https://api.spotify.com/v1/recommendations";
    const params = new URLSearchParams();
    
    // Add seed tracks
    params.append("seed_tracks", seedTracks.join(","));
    
    // Add limit (default to 10, max 100)
    const limit = Math.min(options.limit || 10, 100);
    params.append("limit", limit.toString());
    
    // Add optional audio feature filters
    const audioFeatures = [
      'target_energy', 'min_energy', 'max_energy',
      'target_valence', 'min_valence', 'max_valence',
      'target_danceability', 'min_danceability', 'max_danceability',
      'target_acousticness', 'min_acousticness', 'max_acousticness',
      'target_tempo', 'min_tempo', 'max_tempo',
      'target_popularity', 'min_popularity', 'max_popularity',
      'target_instrumentalness', 'min_instrumentalness', 'max_instrumentalness',
      'target_liveness', 'min_liveness', 'max_liveness',
      'target_speechiness', 'min_speechiness', 'max_speechiness'
    ];
    
    audioFeatures.forEach(feature => {
      if (options[feature] !== undefined) {
        params.append(feature, options[feature].toString());
      }
    });
    
    const url = `${baseUrl}?${params.toString()}`;
    console.log("Fetching recommendations from:", url);
    console.log("Seed tracks:", seedTracks);
    
    const res = await fetcher(url, token);
    console.log("Recommendations response received");
    
    const tracks = res.data?.tracks;
    if (!tracks || tracks.length === 0) {
      console.warn("No recommendations found");
      return [];
    }
    
    console.log(`Received ${tracks.length} recommendations`);
    
    // Format the recommendations using the existing formatter
    const formattedTracks = formatter(tracks);
    
    console.log(`Formatted ${formattedTracks.length} recommendation tracks`);
    return formattedTracks;
    
  } catch (e) {
    console.error("Error in getSpotifyRecommendations:", e);
    
    if (e.response?.status === 401) {
      throw e;
    }
    
    return [];
  }
};
