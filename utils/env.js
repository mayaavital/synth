import { encode as btoa } from 'base-64';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Utility function to create a code challenge for PKCE
// This is a standalone utility to be used if needed
export const createCodeChallenge = async (codeVerifier) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to base64 url-safe format
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
  return base64;
};

// NOTE: Spotify does not support the AppOwnership session
// Instead, you need to create a custom scheme in app.json:
// {
//   "expo": {
//     "scheme": "synth"
//   }
// }

// Validate Spotify app configuration
console.log("==== SPOTIFY CONFIGURATION DEBUG ====");
console.log("Constants.appOwnership:", Constants.appOwnership);
console.log("Constants.expoConfig:", Constants.expoConfig ? "Available" : "Not Available");
console.log("Constants.expoConfig?.extra:", Constants.expoConfig?.extra ? "Available" : "Not Available");
console.log("Spotify Client ID from config:", Constants.expoConfig?.extra?.spotifyClientId || "Not Found");

// Spotify credentials and configuration
// IMPORTANT: These variables should be passed in as environment variables in production
// For local development, it's okay to hardcode them here, but never commit secrets
const CLIENT_ID = "44bc87fe29004136b77183319f56338e";

// Determine the redirect URI based on platform and environment
const getRedirectUri = () => {
  // When running in a managed Expo environment
  if (Constants.appOwnership === 'expo') {
    return `https://auth.expo.io/@${Constants.expoConfig?.owner || 'unknown'}/synth`;
  }
  
  // For development on iOS Simulator or Android Emulator
  if (__DEV__) {
    if (Platform.OS === 'ios') {
      return 'synth://callback';
    }
    return 'synth://spotify-auth-callback';
  }
  
  // For production builds
  if (Platform.OS === 'ios') {
    return `synth://spotify-auth-callback`;
  }
  
  // Android production build
  return `synth://spotify-auth-callback`;
};

// For Spotify, this is critical to get right
const REDIRECT_URI = getRedirectUri();

// Print configuration for debugging
console.log("CLIENT_ID:", CLIENT_ID);
console.log("REDIRECT_URI:", REDIRECT_URI);
console.log("Platform.OS:", Platform.OS);
console.log("__DEV__:", __DEV__);

// Spotify API endpoints
const SPOTIFY_API = {
  AUTHORIZATION_ENDPOINT: 'https://accounts.spotify.com/authorize',
  TOKEN_ENDPOINT: 'https://accounts.spotify.com/api/token',
  DISCOVERY: {
    authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
  },
  // Add missing API endpoints
  TOP_TRACKS_API: 'https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=50',
  ALBUM_TRACK_API_GETTER: (albumId) => `https://api.spotify.com/v1/albums/${albumId}`,
  // Add endpoint for individual track details
  TRACK_API_GETTER: (trackId) => `https://api.spotify.com/v1/tracks/${trackId}`
};

// Permission scopes requested from Spotify
// Add or remove scopes based on what your app needs
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'user-library-read',
  'playlist-read-private',
  'user-read-currently-playing',
  'user-modify-playback-state',
  'streaming'
];

// Choose a specific album if your app needs it
const ALBUM_ID = '6PbnGueEO6LGodPfvNldYf'; // Album ID specified by the user

// Export all environment configuration
const getEnv = () => {
  return {
    CLIENT_ID,
    REDIRECT_URI,
    SCOPES,
    ALBUM_ID,
    SPOTIFY_API,
    IS_DEVELOPMENT: __DEV__,
  };
};

export default getEnv;
