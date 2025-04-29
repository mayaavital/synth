import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * SpotifyEmbed Component
 * 
 * This component provides a more reliable way to play Spotify tracks in a React Native app
 * compared to direct audio URL playback. It uses Spotify's official Embed Player which:
 * 
 * Advantages:
 * - More reliable playback (not dependent on preview_url availability)
 * - Complies with Spotify's terms of service
 * - Provides consistent UI across devices
 * - Handles authentication and licensing issues properly
 * - Works with all Spotify tracks, not just those with preview URLs
 * - Higher audio quality than preview URLs
 * - Player automatically handles track position and duration
 * 
 * How it works:
 * 1. The component creates a WebView that loads Spotify's embed player
 * 2. It uses Spotify's Embed API to control playback and receive events
 * 3. Communication between React Native and the WebView is handled through messages
 * 4. The component exposes play/pause methods and various event callbacks
 * 
 * Usage:
 * <SpotifyEmbed
 *   trackId="your_spotify_track_id"  // Required: Spotify's track ID
 *   uri="spotify:track:trackId"      // Optional: Full Spotify URI (will be constructed from trackId if not provided)
 *   onReady={() => {}}               // Called when player is ready
 *   onPlay={() => {}}                // Called when playback starts
 *   onPause={() => {}}               // Called when playback pauses
 *   onEnd={() => {}}                 // Called when track finishes playing
 *   onError={(error) => {}}          // Called on errors
 *   autoplay={true}                  // Whether to autoplay when loaded
 * />
 * 
 * Control methods:
 * - SpotifyEmbed.play() - Starts playback
 * - SpotifyEmbed.pause() - Pauses playback
 */
const SpotifyEmbed = ({ 
  trackId, 
  uri, 
  onReady, 
  onPlay, 
  onPause, 
  onEnd, 
  onError,
  autoplay = false 
}) => {
  const webViewRef = useRef(null);
  
  // Create a Spotify embeddable URL from the trackId
  const getSpotifyEmbedUrl = () => {
    if (!trackId) return '';
    
    // Compact version (for our mini player)
    return `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;
  };
  
  // Handle messages from the WebView
  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('Message from WebView:', message);
      
      switch (message.type) {
        case 'ready':
          if (onReady) onReady();
          break;
        case 'play':
          if (onPlay) onPlay();
          break;
        case 'pause':
          if (onPause) onPause();
          break;
        case 'ended':
          if (onEnd) onEnd();
          break;
        case 'error':
          if (onError) onError(message.error);
          break;
      }
    } catch (e) {
      console.log('Error parsing message from WebView:', e);
    }
  };
  
  // Inject JavaScript to control and listen to the Spotify player
  const injectSpotifyPlayerScript = `
    (function() {
      // Wait for Spotify player to be ready
      window.onSpotifyIframeApiReady = (IFrameAPI) => {
        const element = document.getElementById('embed-iframe');
        const options = {
          uri: '${uri || `spotify:track:${trackId}`}'
        };
        const callback = (EmbedController) => {
          // Send ready event to React Native
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'ready'}));
          
          // Listen to player events
          EmbedController.addListener('playback_update', (e) => {
            if (e.data.isPaused) {
              window.ReactNativeWebView.postMessage(JSON.stringify({type: 'pause'}));
            } else {
              window.ReactNativeWebView.postMessage(JSON.stringify({type: 'play'}));
            }
            
            if (e.data.position >= e.data.duration) {
              window.ReactNativeWebView.postMessage(JSON.stringify({type: 'ended'}));
            }
          });
          
          // Handle initial autoplay if needed
          if (${autoplay}) {
            setTimeout(() => {
              EmbedController.play();
            }, 1000);
          }
          
          // Store controller reference for external control
          window.spotifyController = EmbedController;
        };
        
        IFrameAPI.createController(element, options, callback);
      };
      
      // Handle errors
      window.onerror = function(message, source, lineno, colno, error) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          error: {message, source, lineno, colno}
        }));
        return true;
      };
      
      true;
    })();
  `;
  
  // Control functions that can be called from outside
  useEffect(() => {
    return () => {
      // Cleanup function
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.spotifyController) {
            window.spotifyController.pause();
          }
          true;
        `);
      }
    };
  }, []);
  
  // Method to play track
  const play = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.spotifyController) {
          window.spotifyController.play();
        }
        true;
      `);
    }
  };
  
  // Method to pause track
  const pause = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.spotifyController) {
          window.spotifyController.pause();
        }
        true;
      `);
    }
  };
  
  // Expose control methods
  SpotifyEmbed.play = play;
  SpotifyEmbed.pause = pause;
  
  // Don't render anything if no trackId is provided
  if (!trackId) {
    return null;
  }
  
  // HTML to load in WebView
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://open.spotify.com/embed-podcast/iframe-api/v1" async></script>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: transparent;
            overflow: hidden;
          }
          .container {
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          #embed-iframe {
            border-radius: 12px;
            width: 100%;
            height: 100%;
            border: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div id="embed-iframe"></div>
        </div>
      </body>
    </html>
  `;
  
  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        originWhitelist={['*']}
        onMessage={handleMessage}
        injectedJavaScript={injectSpotifyPlayerScript}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={Platform.OS !== 'android'}
        javaScriptEnabled={true}
        bounces={false}
        automaticallyAdjustContentInsets={false}
        scalesPageToFit={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default SpotifyEmbed; 