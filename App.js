import { View, Text } from 'react-native';
import { useFonts } from 'expo-font';
import { useCallback } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function App() {
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

  if (!fontsLoaded) {
    return null;
  }

  // Return a wrapper that renders the Expo Router
  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Stack />
    </View>
  );
}
