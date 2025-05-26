import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  ResponseType,
  useAuthRequest,
} from "expo-auth-session";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import getEnv from "./env";

const {
  REDIRECT_URI,
  SCOPES,
  CLIENT_ID,
  SPOTIFY_API: { DISCOVERY },
} = getEnv();

// Token storage keys
const TOKEN_STORAGE_KEY = "spotify_access_token";
const TOKEN_EXPIRATION_KEY = "spotify_token_expiration";
const REFRESH_TOKEN_KEY = "spotify_refresh_token";

// needed so that the browser closes the modal after auth token
WebBrowser.maybeCompleteAuthSession();

// Create the context
const SpotifyAuthContext = createContext(null);

// Provider component
export const SpotifyAuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [tokenExpiration, setTokenExpiration] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Define auth request using Auth Code with PKCE
  const [request, response, promptAsync] = useAuthRequest(
    {
      responseType: ResponseType.Code,
      clientId: CLIENT_ID,
      scopes: SCOPES,
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
      console.log("🔐 CONTEXT: SAVING TOKEN DATA TO ASYNCSTORAGE:");
      console.log("- Token length:", token ? token.length : 0);
      console.log("- Expires at:", new Date(expiresAt).toISOString());
      console.log("- Has refresh token:", !!refresh);
      
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
      await AsyncStorage.setItem(TOKEN_EXPIRATION_KEY, expiresAt.toString());
      if (refresh) {
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh);
      }
      console.log("✅ CONTEXT: Token data saved to storage successfully");
    } catch (error) {
      console.error("❌ CONTEXT: Error saving token data to storage:", error);
    }
  };

  // Load token data from storage
  const loadTokenData = async () => {
    try {
      console.log("🔄 CONTEXT: Loading token data from storage");
      const storedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      const storedExpiration = await AsyncStorage.getItem(TOKEN_EXPIRATION_KEY);
      const storedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);

      if (storedToken && storedExpiration) {
        const expirationTime = parseInt(storedExpiration);

        // Only restore token if it's not expired
        if (expirationTime > Date.now()) {
          console.log("✅ CONTEXT: Loaded valid token from storage");
          setToken(storedToken);
          setTokenExpiration(expirationTime);
          if (storedRefreshToken) {
            setRefreshToken(storedRefreshToken);
          }
        } else if (storedRefreshToken) {
          console.log("⚠️ CONTEXT: Stored token is expired, attempting refresh");
          try {
            await refreshAccessToken(storedRefreshToken);
          } catch (refreshError) {
            console.error("❌ CONTEXT: Error refreshing token:", refreshError);
            await clearTokenData();
          }
        } else {
          console.log("❌ CONTEXT: Stored token is expired and no refresh token available");
          await clearTokenData();
        }
      } else {
        console.log("ℹ️ CONTEXT: No stored token found or missing expiration");
      }

      setIsInitialized(true);
    } catch (error) {
      console.error("❌ CONTEXT: Error loading token from storage:", error);
      setIsInitialized(true);
    }
  };

  // Clear all token data
  const clearTokenData = async () => {
    try {
      console.log("🗑️ CONTEXT: CLEARING ALL TOKEN DATA FROM ASYNCSTORAGE");
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
      await AsyncStorage.removeItem(TOKEN_EXPIRATION_KEY);
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
      console.log("✅ CONTEXT: All token data cleared successfully");
    } catch (error) {
      console.error("❌ CONTEXT: Error clearing token data:", error);
    }
  };

  // Refresh the access token using the refresh token
  const refreshAccessToken = async (refreshTokenToUse) => {
    try {
      console.log("🔄 CONTEXT: Attempting to refresh access token");
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
      await saveTokenData(newToken, expirationTime, newRefreshToken);

      console.log("✅ CONTEXT: Token refresh successful");
      return newToken;
    } catch (error) {
      console.error("❌ CONTEXT: Error refreshing access token:", error);
      throw error;
    }
  };

  // Check if the token is valid
  const isTokenValid = () => {
    if (!token || !tokenExpiration) {
      return false;
    }
    
    // Use 30-second buffer
    const isValid = tokenExpiration > Date.now() + 30000;
    return isValid;
  };

  // Get a valid token (refreshes if expired)
  const getValidToken = async () => {
    console.log("🎯 CONTEXT: GET_VALID_TOKEN CALLED");
    console.log("- Has token:", !!token);
    console.log("- Token valid:", isTokenValid());
    
    if (isTokenValid()) {
      console.log("✅ CONTEXT: Current token is valid, returning it");
      return token;
    }

    console.log("⚠️ CONTEXT: Current token is invalid, checking refresh token");
    console.log("- Has refresh token:", !!refreshToken);

    // Try to refresh the token if we have a refresh token
    if (refreshToken) {
      try {
        console.log("🔄 CONTEXT: Token expired, attempting to refresh...");
        const newToken = await refreshAccessToken(refreshToken);
        console.log("✅ CONTEXT: Token refresh successful");
        return newToken;
      } catch (refreshError) {
        console.error("❌ CONTEXT: Failed to refresh token:", refreshError.message);
        
        // Check if it's a network error vs authorization error
        if (refreshError.message?.includes('network') || refreshError.message?.includes('fetch')) {
          console.log("⚠️ CONTEXT: Network error detected - token may still be valid for some operations");
          return null;
        }
        
        // Only clear tokens for actual auth errors
        if (refreshError.message?.includes('invalid_grant') || refreshError.message?.includes('unauthorized')) {
          console.log("❌ CONTEXT: Authorization error detected - clearing tokens");
          await logout();
        }
      }
    }

    // If we get here and have no refresh token, we need to re-authenticate
    if (!refreshToken) {
      console.log("🚨 CONTEXT: No refresh token available, clearing token data");
      await logout();
    }
    
    return null;
  };

  // Clear token data and log out
  const logout = async () => {
    console.log("🚪 CONTEXT: LOGOUT CALLED - clearing all token state and storage");
    setToken(null);
    setTokenExpiration(null);
    setRefreshToken(null);
    await clearTokenData();
    console.log("✅ CONTEXT: Logged out and token data cleared");
  };

  // Handle authentication response
  useEffect(() => {
    const handleResponse = async () => {
      try {
        if (response?.type === "success" && response.params?.code) {
          console.log("🎉 CONTEXT: Authentication successful, exchanging code for token");
          const tokenData = await exchangeCodeForToken(response.params.code);

          const newToken = tokenData.access_token;
          const newRefreshToken = tokenData.refresh_token;
          const expiresIn = parseInt(tokenData.expires_in) || 3600;
          const expirationTime = Date.now() + expiresIn * 1000;

          // Save token and expiration
          setToken(newToken);
          setTokenExpiration(expirationTime);
          setRefreshToken(newRefreshToken);
          await saveTokenData(newToken, expirationTime, newRefreshToken);

          console.log("✅ CONTEXT: Authenticated with expiration in", expiresIn, "seconds");
          setAuthError(null);
        } else if (response?.type === "error") {
          console.error("❌ CONTEXT: Auth error:", response.error);
          setAuthError(response.error.message || "Authentication failed");
        }
      } catch (error) {
        console.error("❌ CONTEXT: Error handling auth response:", error);
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

  // Context value
  const contextValue = {
    token,
    tokenExpiration,
    refreshToken,
    isInitialized,
    authError,
    isTokenValid,
    getValidToken,
    getSpotifyAuth: promptAsync,
    logout,
  };

  return (
    <SpotifyAuthContext.Provider value={contextValue}>
      {children}
    </SpotifyAuthContext.Provider>
  );
};

// Custom hook to use the context
export const useSpotifyAuth = () => {
  const context = useContext(SpotifyAuthContext);
  if (!context) {
    throw new Error('useSpotifyAuth must be used within a SpotifyAuthProvider');
  }
  return context;
};

export default useSpotifyAuth; 