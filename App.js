import { View, Text } from 'react-native';
import { useFonts } from 'expo-font';
import { useCallback, useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function App() {
  const router = useRouter();

  // Load fonts if needed
  const [fontsLoaded] = useFonts({
    // You can add custom fonts here if needed
    // 'MyFont': require('./assets/fonts/MyFont.ttf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      // Hide the splash screen
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Handle deep links
  useEffect(() => {
    console.log('Setting up deep link handling');
    
    // Handler for when the app is opened from a deep link
    const handleDeepLink = (event) => {
      let url = event.url;
      console.log('Deep link detected:', url);
      
      // Process the URL
      if (url.startsWith('synth://join')) {
        try {
          // Parse the URL
          const urlObj = new URL(url);
          const params = urlObj.searchParams;
          
          // Get the game parameters
          const gameId = params.get('gameId');
          const serverUrl = params.get('serverUrl');
          const gameName = params.get('gameName');
          
          if (gameId) {
            // Navigate to join-by-code screen with parameters
            router.push({
              pathname: "/join-by-code",
              params: {
                gameId,
                serverUrl,
                gameName
              }
            });
          }
        } catch (error) {
          console.error('Error processing deep link:', error);
        }
      }
      // Handle Spotify authentication callback
      else if (url.startsWith('synth://callback') || url.includes('/--/callback')) {
        try {
          console.log('Spotify auth callback detected:', url);
          // The URL should contain a code parameter that we need to handle
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          const error = urlObj.searchParams.get('error');
          
          if (code) {
            console.log('Spotify auth code received:', code);
            // We'll let the event listener in useSpotifyAuth.js handle this
            // No navigation needed here as the auth is handled by the hook
          } else if (error) {
            console.error('Spotify auth error:', error);
            // Optionally navigate to an error screen
          }
        } catch (error) {
          console.error('Error processing Spotify callback:', error);
        }
      } else {
        console.log('Unhandled deep link format:', url);
      }
    };

    // Add event listener for when the app is opened from a deep link
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Check if app was opened from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Cleanup
    return () => {
      subscription.remove();
    };
  }, [router]);

  if (!fontsLoaded) {
    return null;
  }

  // Return a wrapper that renders the Expo Router
  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Stack />
      <StatusBar style="auto" />
    </View>
  );
}
