import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Star component that creates a 4-pointed star shape
const Star = ({ size, style }) => {
  return (
    <View style={[styles.starContainer, { width: size, height: size }, style]}>
      <View style={[styles.starVertical, { 
        width: size * 0.3, 
        height: size,
        backgroundColor: style?.backgroundColor || '#333333'
      }]} />
      <View style={[styles.starHorizontal, { 
        width: size, 
        height: size * 0.3,
        backgroundColor: style?.backgroundColor || '#333333'
      }]} />
    </View>
  );
};

const ResponsiveTitle = () => {
  // Calculate responsive sizes
  const isTabletOrDesktop = screenWidth >= 768;
  const titleFontSize = isTabletOrDesktop ? Math.min(screenWidth * 0.12, 120) : Math.min(screenWidth * 0.15, 80);
  const containerHeight = isTabletOrDesktop ? screenHeight * 0.25 : screenHeight * 0.2;
  const starSize = titleFontSize * 0.25;
  
  return (
    <View style={[styles.container, { height: containerHeight }]}>
      {/* Decorative stars/sparkles */}
      <View style={styles.starsContainer}>
        <Star 
          size={starSize} 
          style={{ backgroundColor: '#333333', opacity: 0.8 }} 
        />
        <Star 
          size={starSize * 1.2} 
          style={{ backgroundColor: '#444444', opacity: 1 }} 
        />
        <Star 
          size={starSize} 
          style={{ backgroundColor: '#333333', opacity: 0.8 }} 
        />
      </View>
      
      {/* SYNTH text */}
      <Text style={[styles.titleText, { fontSize: titleFontSize }]}>
        SYNTH
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    width: '80%',
    gap: 15,
  },
  starContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  starVertical: {
    position: 'absolute',
    borderRadius: 2,
  },
  starHorizontal: {
    position: 'absolute',
    borderRadius: 2,
  },
  titleText: {
    fontFamily: 'System',
    fontWeight: 'bold',
    color: '#8E44AD',
    textAlign: 'center',
    letterSpacing: 3,
    textShadowColor: 'rgba(142, 68, 173, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});

export default ResponsiveTitle; 