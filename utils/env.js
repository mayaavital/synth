import { Platform } from "react-native";

// ***** TODO: Fill in your constants here ***** //
const CLIENT_ID = "44bc87fe29004136b77183319f56338e";
// Old redirect URIs with hardcoded IPs
// const REDIRECT_URI = "exp://172.19.1.98:8081";
// const REDIRECT_URI = "exp://10.27.148.121:8081";
// New redirect URI using the app scheme with proper path
const REDIRECT_URI = "synth://callback";
// const ALBUM_ID = "3c9EsIo34kil8Oj1reaozB"; // LYFESTYLE by Yeat
const ALBUM_ID = "1jXYc5gip5tqCTDOotfY5L"; // 2093 by Yeat
// ********************************************* //

const redirectUri = (uri) => {
  if (!uri) {
    const err = new Error(
      "No redirect URI provided.\nPlease provide a redirect URI in env.js.\n You can find the file in utils/env.js."
    );
    console.error(err);
    alert(err);
  }
  return Platform.OS === "web" ? "http://localhost:19006/" : uri;
};

const ENV = {
  CLIENT_ID: CLIENT_ID,
  SCOPES: [
    "user-read-currently-playing",
    "user-read-recently-played",
    "user-read-playback-state",
    "user-top-read",
    "user-modify-playback-state",
    "streaming",
    "user-read-email",
    "user-read-private",
  ],
  REDIRECT_URI: redirectUri(REDIRECT_URI),
  ALBUM_ID: ALBUM_ID,
  SPOTIFY_API: {
    // Endpoints for auth & token flow
    DISCOVERY: {
      authorizationEndpoint: "https://accounts.spotify.com/authorize",
      tokenEndpoint: "https://accounts.spotify.com/api/token",
    },
    // ***** TODO: Fill this in ***** //
    TOP_TRACKS_API: "https://api.spotify.com/v1/me/shows?offset=0&limit=20",
    // ***** TODO: Or fill this in ***** //
    ALBUM_TRACK_API_GETTER: (albumId) => `https://api.spotify.com/v1/albums/${albumId}`,
  },
};

const getEnv = () => ENV;
export default getEnv;
// ^ use this type of exporting to ensure compliance with webpack and expo-web
