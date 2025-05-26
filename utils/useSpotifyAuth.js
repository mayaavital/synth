// ⚠️ DEPRECATED: This file has been replaced by SpotifyAuthContext.js
// Please use the new Context-based implementation instead
// This file is kept for reference only and should not be imported

import getEnv from "./env";
import { useState, useEffect } from "react";
import {
  ResponseType,
  useAuthRequest,
  makeRedirectUri,
} from "expo-auth-session";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { ResponseError } from "expo-auth-session/build/Errors";
import * as Linking from "expo-linking";

const {
  REDIRECT_URI,
  SCOPES,
  CLIENT_ID,
  ALBUM_ID,
  SPOTIFY_API: { DISCOVERY },
} = getEnv();

console.log("redirect: ", REDIRECT_URI);
// Log configuration for debugging
console.log("Auth Configuration:", {
  CLIENT_ID: CLIENT_ID?.slice(0, 5) + "...", // Only show part of the ID for security
  REDIRECT_URI,
  SCOPES: SCOPES?.length,
});

// Token storage keys
const TOKEN_STORAGE_KEY = "spotify_access_token";
const TOKEN_EXPIRATION_KEY = "spotify_token_expiration";
const REFRESH_TOKEN_KEY = "spotify_refresh_token";

// needed so that the browser closes the modal after auth token
WebBrowser.maybeCompleteAuthSession();

const useSpotifyAuth = () => {
  const [token, setToken] = useState(null);
  const [tokenExpiration, setTokenExpiration] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Define auth request using Auth Code with PKCE (more reliable than Implicit flow)
  const [request, response, promptAsync] = useAuthRequest(
    {
      responseType: ResponseType.Code,
      clientId: CLIENT_ID,
      scopes: SCOPES,
      // Enable PKCE for Code flow
      usePKCE: true,
      redirectUri: REDIRECT_URI,
    },
    DISCOVERY
  );

  // Exchange code for tokens
  const exchangeCodeForToken = async (code) => {
    try {
      const tokenEndpoint = DISCOVERY.tokenEndpoint;
      const redirectUri = REDIRECT_URI;

      const params = new URLSearchParams();
      params.append("client_id", CLIENT_ID);
      params.append("grant_type", "authorization_code");
      params.append("code", code);
      params.append("redirect_uri", redirectUri);
      params.append("code_verifier", request.codeVerifier || "");

      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Token exchange failed: ${errorData.error}`);
      }

      const tokenData = await response.json();
      return tokenData;
    } catch (error) {
      console.error("Error exchanging code for token:", error);
      throw error;
    }
  };

  // Save token data to storage
  const saveTokenData = async (token, expiresAt, refresh = null) => {
    try {
      console.log("🔐 SAVING TOKEN DATA TO ASYNCSTORAGE:");
      console.log("- Token length:", token ? token.length : 0);
      console.log("- Expires at:", new Date(expiresAt).toISOString());
      console.log("- Has refresh token:", !!refresh);
      
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
      await AsyncStorage.setItem(TOKEN_EXPIRATION_KEY, expiresAt.toString());
      if (refresh) {
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh);
      }
      console.log("✅ Token data saved to storage successfully");
      
      // Verify the save by reading it back immediately
      const verifyToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      const verifyExpiration = await AsyncStorage.getItem(TOKEN_EXPIRATION_KEY);
      console.log("🔍 VERIFICATION - Token saved correctly:", !!verifyToken);
      console.log("🔍 VERIFICATION - Expiration saved correctly:", !!verifyExpiration);
      
    } catch (error) {
      console.error("❌ Error saving token data to storage:", error);
    }
  };

  // Load token data from storage
  const loadTokenData = async () => {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      const storedExpiration = await AsyncStorage.getItem(TOKEN_EXPIRATION_KEY);
      const storedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);

      if (storedToken && storedExpiration) {
        const expirationTime = parseInt(storedExpiration);

        // Only restore token if it's not expired
        if (expirationTime > Date.now()) {
          console.log("Loaded valid token from storage");
          setToken(storedToken);
          setTokenExpiration(expirationTime);
          if (storedRefreshToken) {
            setRefreshToken(storedRefreshToken);
          }
        } else if (storedRefreshToken) {
          console.log("Stored token is expired, attempting refresh");
          try {
            await refreshAccessToken(storedRefreshToken);
          } catch (refreshError) {
            console.error("Error refreshing token:", refreshError);
            // Clear the expired tokens
            await clearTokenData();
          }
        } else {
          console.log("Stored token is expired and no refresh token available");
          // Clear the expired token
          await clearTokenData();
        }
      } else {
        console.log("No stored token found or missing expiration");
      }

      setIsInitialized(true);
    } catch (error) {
      console.error("Error loading token from storage:", error);
      setIsInitialized(true);
    }
  };

  // Clear all token data
  const clearTokenData = async () => {
    try {
      console.log("🗑️ CLEARING ALL TOKEN DATA FROM ASYNCSTORAGE");
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
      await AsyncStorage.removeItem(TOKEN_EXPIRATION_KEY);
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
      console.log("✅ All token data cleared successfully");
    } catch (error) {
      console.error("❌ Error clearing token data:", error);
    }
  };

  // Refresh the access token using the refresh token
  const refreshAccessToken = async (refreshTokenToUse) => {
    try {
      const tokenEndpoint = DISCOVERY.tokenEndpoint;

      const params = new URLSearchParams();
      params.append("client_id", CLIENT_ID);
      params.append("grant_type", "refresh_token");
      params.append("refresh_token", refreshTokenToUse);

      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Token refresh failed: ${errorData.error}`);
      }

      const tokenData = await response.json();
      const newToken = tokenData.access_token;
      const expiresIn = tokenData.expires_in || 3600;
      const expirationTime = Date.now() + expiresIn * 1000;
      const newRefreshToken = tokenData.refresh_token || refreshTokenToUse;

      // Save the new tokens
      setToken(newToken);
      setTokenExpiration(expirationTime);
      setRefreshToken(newRefreshToken);
      saveTokenData(newToken, expirationTime, newRefreshToken);

      return newToken;
    } catch (error) {
      console.error("Error refreshing access token:", error);
      throw error;
    }
  };

  // Handle authentication response
  useEffect(() => {
    const handleResponse = async () => {
      try {
        if (response?.type === "success" && response.params?.code) {
          // Exchange the code for a token
          const tokenData = await exchangeCodeForToken(response.params.code);

          const newToken = tokenData.access_token;
          const newRefreshToken = tokenData.refresh_token;
          const expiresIn = parseInt(tokenData.expires_in) || 3600;
          const expirationTime = Date.now() + expiresIn * 1000;

          // Save token and expiration
          setToken(newToken);
          setTokenExpiration(expirationTime);
          setRefreshToken(newRefreshToken);
          saveTokenData(newToken, expirationTime, newRefreshToken);

          console.log("Authenticated with expiration in", expiresIn, "seconds");
          setAuthError(null); // Clear any previous errors
        } else if (response?.type === "error") {
          console.error("Auth error:", response.error);
          setAuthError(response.error.message || "Authentication failed");
        }
      } catch (error) {
        console.error("Error handling auth response:", error);
        setAuthError(error.message || "Authentication failed");
      }
    };

    if (response) {
      handleResponse();
    }
  }, [response]);

  // Load token on mount
  useEffect(() => {
    loadTokenData();
  }, []);

  // Check if the token is valid
  const isTokenValid = () => {
    console.log("🔍 CHECKING TOKEN VALIDITY:");
    console.log("- Has token:", !!token);
    console.log("- Token length:", token ? token.length : 0);
    console.log("- Has tokenExpiration:", !!tokenExpiration);
    console.log("- TokenExpiration value:", tokenExpiration);
    console.log("- Current time:", Date.now());
    console.log("- Expiration time:", tokenExpiration);
    console.log("- Time until expiration:", tokenExpiration ? Math.round((tokenExpiration - Date.now()) / 1000) : 'N/A', "seconds");
    
    if (!token || !tokenExpiration) {
      console.log("❌ Token invalid: missing token or expiration");
      return false;
    }
    
    // Reduce buffer to 30 seconds to be less aggressive
    const isValid = tokenExpiration > Date.now() + 30000;
    console.log("✅ Token valid:", isValid);
    return isValid;
  };

  // Get a valid token (refreshes if expired)
  const getValidToken = async () => {
    console.log("🎯 GET_VALID_TOKEN CALLED");
    console.log("- Called from:", new Error().stack.split('\n')[2]); // Show where it was called from
    
    if (isTokenValid()) {
      console.log("✅ Current token is valid, returning it");
      return token;
    }

    console.log("⚠️ Current token is invalid, checking refresh token");
    console.log("- Has refresh token:", !!refreshToken);
    console.log("- Refresh token length:", refreshToken ? refreshToken.length : 0);

    // Try to refresh the token if we have a refresh token
    if (refreshToken) {
      try {
        console.log("🔄 Token expired, attempting to refresh...");
        const newToken = await refreshAccessToken(refreshToken);
        console.log("✅ Token refresh successful");
        return newToken;
      } catch (refreshError) {
        console.error("❌ Failed to refresh token:", refreshError.message);
        // Don't automatically logout on refresh failure - let the caller handle it
        console.log("🚨 Token refresh failed, but NOT clearing token data automatically");
        
        // Check if it's a network error vs authorization error
        if (refreshError.message?.includes('network') || refreshError.message?.includes('fetch')) {
          console.log("Network error detected - token may still be valid for some operations");
          return null; // Return null but don't clear tokens
        }
        
        // Only clear tokens for actual auth errors
        if (refreshError.message?.includes('invalid_grant') || refreshError.message?.includes('unauthorized')) {
          console.log("Authorization error detected - clearing tokens");
          await logout();
        }
      }
    }

    // If we get here and have no refresh token, we need to re-authenticate
    if (!refreshToken) {
      console.log("🚨 No refresh token available, clearing token data");
      await logout();
    }
    
    return null;
  };

  // Clear token data and log out
  const logout = async () => {
    console.log("🚪 LOGOUT CALLED - clearing all token state and storage");
    setToken(null);
    setTokenExpiration(null);
    setRefreshToken(null);
    await clearTokenData();
    console.log("Logged out and token data cleared");
  };

  // Add a direct alternative method for iOS development builds
  const getSpotifyAuthDirectIOS = async () => {
    try {
      // Create a direct link to Spotify that will open in Safari
      const spotifyAuthUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
        REDIRECT_URI
      )}&response_type=code&scope=${encodeURIComponent(SCOPES.join(" "))}`;

      console.log("Opening Spotify auth directly in Safari:", spotifyAuthUrl);

      // Set up listener for redirect URL
      const urlListener = Linking.addEventListener(
        "url",
        handleSpotifyRedirect
      );

      // Open Safari with auth URL
      await Linking.openURL(spotifyAuthUrl);

      return { type: "direct-ios-auth-started" };
    } catch (error) {
      console.error("Error starting direct iOS auth:", error);
      setAuthError("Failed to open Spotify login");
      throw error;
    }
  };

  // Handle Spotify redirect when app is opened via URL scheme
  const handleSpotifyRedirect = async (event) => {
    try {
      console.log("App opened via URL:", event.url);

      // Parse the URL to extract authorization code
      const url = new URL(event.url);
      const code = url.searchParams.get("code");

      if (code) {
        console.log("Received authorization code from Spotify redirect");

        // Exchange code for tokens
        const tokenData = await exchangeCodeForToken(code);

        if (tokenData && tokenData.access_token) {
          const newToken = tokenData.access_token;
          const newRefreshToken = tokenData.refresh_token;
          const expiresIn = parseInt(tokenData.expires_in) || 3600;
          const expirationTime = Date.now() + expiresIn * 1000;

          // Save token data
          setToken(newToken);
          setTokenExpiration(expirationTime);
          setRefreshToken(newRefreshToken);
          await saveTokenData(newToken, expirationTime, newRefreshToken);

          console.log("Successfully authenticated with Spotify");
          setAuthError(null);
        }
      } else {
        console.error("No code found in redirect URL");
        setAuthError("Authentication failed - no code returned");
      }
    } catch (error) {
      console.error("Error handling Spotify redirect:", error);
      setAuthError(error.message || "Authentication failed");
    }
  };

  return {
    token,
    isTokenValid,
    getValidToken,
    getSpotifyAuth: promptAsync,
    getSpotifyAuthDirect: getSpotifyAuthDirectIOS,
    logout,
    isInitialized,
    authError,
  };
};

export default useSpotifyAuth;
