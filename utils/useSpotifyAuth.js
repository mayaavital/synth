import getEnv from "./env";
import { useState, useEffect } from "react";
import {
  ResponseType,
  useAuthRequest,
  makeRedirectUri,
} from "expo-auth-session";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from "expo-web-browser";
import { ResponseError } from "expo-auth-session/build/Errors";

const {
  REDIRECT_URI,
  SCOPES,
  CLIENT_ID,
  ALBUM_ID,
  SPOTIFY_API: { DISCOVERY },
} = getEnv();

// Log configuration for debugging
console.log("Auth Configuration:", {
  CLIENT_ID: CLIENT_ID?.slice(0, 5) + "...", // Only show part of the ID for security
  REDIRECT_URI,
  SCOPES: SCOPES?.length,
});

// Token storage key
const TOKEN_STORAGE_KEY = 'spotify_access_token';

// needed so that the browser closes the modal after auth token
WebBrowser.maybeCompleteAuthSession();

const useSpotifyAuth = () => {
  const [token, setToken] = useState(null);
  const [request, response, promptAsync] = useAuthRequest(
    {
      responseType: ResponseType.Token,
      clientId: CLIENT_ID,
      scopes: SCOPES,
      // In order to follow the "Authorization Code Flow" to fetch token after authorizationEndpoint
      // this must be set to false
      usePKCE: true,
      redirectUri: REDIRECT_URI,
    },
    DISCOVERY
  );

  useEffect(() => {
    if (response?.type === 'success' && response.params?.access_token) {
      setToken(response.params.access_token);
      console.log("Authenticated", JSON.stringify(response.params, null, 2));
    }
  }, [response]);

  // Load token from storage on mount
  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
        if (storedToken) {
          console.log("Loaded token from storage");
          setToken(storedToken);
        } else {
          console.log("No stored token found");
        }
      } catch (error) {
        console.error("Error loading token from storage:", error);
      }
    };
    
    loadToken();
  }, []);

  // Save token to storage when it changes
  useEffect(() => {
    const saveToken = async () => {
      if (token) {
        try {
          await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
          console.log("Token saved to storage");
        } catch (error) {
          console.error("Error saving token to storage:", error);
        }
      }
    };
    
    saveToken();
  }, [token]);

  // Provide a logout function to maintain compatibility with existing code
  const logout = () => {
    setToken(null);
    console.log("Token cleared");
  };

  return { token, getSpotifyAuth: promptAsync, logout };
};

export default useSpotifyAuth;
