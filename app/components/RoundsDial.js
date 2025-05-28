import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

const RoundsDial = ({ value, onValueChange, minValue = 2, maxValue = 20 }) => {
  const [currentValue, setCurrentValue] = useState(value);
  const scrollViewRef = useRef(null);
  const ITEM_HEIGHT = 50;

  useEffect(() => {
    // Initialize scroll position to center the current value
    if (scrollViewRef.current) {
      const initialIndex = currentValue - minValue;
      const initialOffset = initialIndex * ITEM_HEIGHT;
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: initialOffset,
          animated: false,
        });
      }, 100);
    }
  }, []);

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const newValue = Math.max(minValue, Math.min(maxValue, minValue + index));
    
    if (newValue !== currentValue) {
      setCurrentValue(newValue);
      onValueChange(newValue);
    }
  };

  const handleScrollEnd = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const snapOffset = index * ITEM_HEIGHT;
    
    scrollViewRef.current?.scrollTo({
      y: snapOffset,
      animated: true,
    });
  };

  const renderItems = () => {
    const items = [];
    for (let i = minValue; i <= maxValue; i++) {
      items.push(
        <View key={i} style={styles.dialItem}>
          <Text
            style={[
              styles.dialItemText,
              i === currentValue && styles.dialItemTextSelected,
            ]}
          >
            {i}
          </Text>
        </View>
      );
    }
    return items;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Number of Rounds</Text>
      <View style={styles.dialContainer}>
        <View style={styles.selectionIndicator} />
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScrollEnd}
          scrollEventThrottle={16}
        >
          {/* Add padding items at top and bottom for proper centering */}
          <View style={[styles.dialItem, { opacity: 0 }]}>
            <Text style={styles.dialItemText}>{minValue}</Text>
          </View>
          <View style={[styles.dialItem, { opacity: 0 }]}>
            <Text style={styles.dialItemText}>{minValue}</Text>
          </View>
          
          {renderItems()}
          
          <View style={[styles.dialItem, { opacity: 0 }]}>
            <Text style={styles.dialItemText}>{maxValue}</Text>
          </View>
          <View style={[styles.dialItem, { opacity: 0 }]}>
            <Text style={styles.dialItemText}>{maxValue}</Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 20,
  },
  label: {
    color: '#CCC',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  dialContainer: {
    height: 250,
    width: 120,
    position: 'relative',
  },
  selectionIndicator: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: 'rgba(142, 68, 173, 0.2)',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#8E44AD',
    zIndex: 1,
    marginTop: -25,
    pointerEvents: 'none',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  dialItem: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    width: 120,
  },
  dialItemText: {
    fontSize: 24,
    color: '#666',
    fontWeight: '500',
  },
  dialItemTextSelected: {
    color: '#8E44AD',
    fontWeight: 'bold',
    fontSize: 28,
  },
});

export default RoundsDial; 