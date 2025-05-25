import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const SpotifyConnectButton = ({ 
  onPress, 
  disabled = false, 
  loading = false, 
  style = {},
  textStyle = {} 
}) => {
  return (
    <TouchableOpacity
      style={[styles.buttonContainer, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['#1ED760', '#1DB954']}
        start={[0, 0]}
        end={[1, 0]}
        style={styles.gradient}
      >
        <View style={styles.buttonContent}>
          <Text style={[styles.buttonText, textStyle]}>Connect to Spotify</Text>
          <View style={styles.logoContainer}>
            <View style={styles.logoBackground}>
              <Image
                source={require('../assets/white-spotify-logo.png')}
                style={styles.spotifyLogo}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  logoContainer: {
    marginLeft: 16,
  },
  logoBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotifyLogo: {
    width: 24,
    height: 24,
    tintColor: '#FFFFFF',
  },
});

export default SpotifyConnectButton; 