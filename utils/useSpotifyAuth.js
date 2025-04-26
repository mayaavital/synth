import getEnv from "./env";
import { useState, useEffect } from "react";
import {
  ResponseType,
  useAuthRequest,
  makeRedirectUri,
  exchangeCodeAsync,
} from "expo-auth-session";

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

// needed so that the browser closes the modal after auth token
WebBrowser.maybeCompleteAuthSession();

const useSpotifyAuth = () => {
  const [token, setToken] = useState(null);
  const [authError, setAuthError] = useState(null);
  
  const [request, response, promptAsync] = useAuthRequest(
    {
      responseType: ResponseType.Code, // Use authorization code flow
      clientId: CLIENT_ID,
      scopes: SCOPES,
      // Enable PKCE for more secure authorization code flow
      usePKCE: true,
      redirectUri: REDIRECT_URI,
    },
    DISCOVERY
  );

  useEffect(() => {
    const getTokenAsync = async () => {
      if (response?.type === 'success' && response.params?.code) {
        try {
          // Exchange the authorization code for an access token
          console.log("Got authorization code, exchanging for token...");
          const tokenResult = await exchangeCodeAsync(
            {
              code: response.params.code,
              clientId: CLIENT_ID,
              redirectUri: REDIRECT_URI,
              extraParams: {
                code_verifier: request?.codeVerifier || '',
              },
            },
            DISCOVERY
          );
          
          setToken(tokenResult.accessToken);
          setAuthError(null);
          console.log("Token exchange successful!");
        } catch (error) {
          console.error("Token exchange error:", error);
          setAuthError(error);
        }
      } else if (response) {
        // Log any other response type for debugging
        console.log("Auth response type:", response.type);
        if (response.type === 'error') {
          setAuthError(response.error);
          console.error("Auth error:", response.error);
        }
      }
    };

    getTokenAsync();
  }, [response, request]);

  const startAuth = async () => {
    console.log("Starting Spotify authentication...");
    try {
      setAuthError(null);
      const result = await promptAsync();
      console.log("Auth prompt result:", result.type);
    } catch (error) {
      console.error("Auth error:", error);
      setAuthError(error);
    }
  };

  return { token, authError, getSpotifyAuth: startAuth };
};

export default useSpotifyAuth;
