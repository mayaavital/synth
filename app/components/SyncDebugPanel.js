import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

/**
 * Debug panel component to display song synchronization information
 * Only shown during development to help debug song distribution issues
 */
export const SyncDebugPanel = ({ 
  currentSong, 
  gameId, 
  currentRound, 
  isMultiplayer, 
  isConnected,
  roundsPlayed = []
}) => {
  // Only render in development mode
  if (!__DEV__) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Song Sync Debug</Text>
      
      <ScrollView style={styles.scrollView}>
        <Text style={styles.sectionTitle}>Connection</Text>
        <View style={styles.itemRow}>
          <Text style={styles.label}>Multiplayer:</Text>
          <Text style={styles.value}>{isMultiplayer ? 'Yes' : 'No'}</Text>
        </View>
        <View style={styles.itemRow}>
          <Text style={styles.label}>Connected:</Text>
          <Text style={[
            styles.value, 
            isConnected ? styles.connected : styles.disconnected
          ]}>
            {isConnected ? 'Yes' : 'No'}
          </Text>
        </View>
        <View style={styles.itemRow}>
          <Text style={styles.label}>Game ID:</Text>
          <Text style={styles.value}>{gameId || 'N/A'}</Text>
        </View>
        <View style={styles.itemRow}>
          <Text style={styles.label}>Round:</Text>
          <Text style={styles.value}>{currentRound || 'N/A'}</Text>
        </View>

        <Text style={styles.sectionTitle}>Current Song</Text>
        {currentSong ? (
          <>
            <View style={styles.itemRow}>
              <Text style={styles.label}>Title:</Text>
              <Text style={styles.value}>{currentSong.songTitle || 'Unknown'}</Text>
            </View>
            <View style={styles.itemRow}>
              <Text style={styles.label}>Artists:</Text>
              <Text style={styles.value}>
                {Array.isArray(currentSong.songArtists) 
                  ? currentSong.songArtists.join(', ') 
                  : (currentSong.songArtists || 'Unknown')}
              </Text>
            </View>
            <View style={styles.itemRow}>
              <Text style={styles.label}>Has Preview:</Text>
              <Text style={[
                styles.value,
                currentSong.previewUrl ? styles.connected : styles.disconnected
              ]}>
                {currentSong.previewUrl ? 'Yes' : 'No'}
              </Text>
            </View>
            <View style={styles.itemRow}>
              <Text style={styles.label}>Trace ID:</Text>
              <Text style={styles.value}>{currentSong.roundTraceId || 'None'}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.noData}>No song data</Text>
        )}

        <Text style={styles.sectionTitle}>Round History</Text>
        {roundsPlayed.length > 0 ? (
          roundsPlayed.map((round, index) => (
            <View key={`round-${index}`} style={styles.roundItem}>
              <Text style={styles.roundTitle}>Round {round.roundNumber}</Text>
              <View style={styles.itemRow}>
                <Text style={styles.label}>Song:</Text>
                <Text style={styles.value}>{round.song?.songTitle || 'Unknown'}</Text>
              </View>
              <View style={styles.itemRow}>
                <Text style={styles.label}>Trace ID:</Text>
                <Text style={styles.value}>{round.song?.roundTraceId || 'None'}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noData}>No rounds played yet</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 300,
    maxHeight: 300,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderTopLeftRadius: 8,
    padding: 8,
    zIndex: 1000,
  },
  title: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  scrollView: {
    maxHeight: 270,
  },
  sectionTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  label: {
    color: '#aaa',
    fontSize: 12,
  },
  value: {
    color: '#fff',
    fontSize: 12,
    maxWidth: 180,
  },
  connected: {
    color: '#4CAF50',
  },
  disconnected: {
    color: '#F44336',
  },
  noData: {
    color: '#aaa',
    fontStyle: 'italic',
    fontSize: 12,
  },
  roundItem: {
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#555',
  },
  roundTitle: {
    color: '#E4F0FB',
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 2,
  },
});

export default SyncDebugPanel; 