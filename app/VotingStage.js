import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';

export default function VotingStage({
  players,
  currentSong,
  currentRound,
  selectedPlayer,
  showVoteResult,
  setSelectedPlayer,
  setShowVoteResult,
  nextRound,
  getProfilePhotoForUser,
  isMultiplayer,
  gameId,
  playerPoints,
  castVote
}) {
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    // Reset vote state when starting a new round
    setVoteSubmitted(false);
    setSelectedPlayer(null);
    setShowVoteResult(false);
  }, [currentRound, setSelectedPlayer, setShowVoteResult]);

  const handleVote = () => {
    if (!selectedPlayer || voteSubmitted) return;
    
    // Animate the button press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Submit vote
    setVoteSubmitted(true);
    
    // If multiplayer, send vote to server
    if (isMultiplayer && gameId && castVote) {
      console.log(`Casting vote for player ${selectedPlayer.username} in game ${gameId}`);
      castVote({
        gameId,
        votedForPlayerId: selectedPlayer.id
      });
    } else {
      // For single player, show result immediately
      setTimeout(() => {
        setShowVoteResult(true);
      }, 500);
    }
  };

  const handleSelectPlayer = (player) => {
    if (voteSubmitted) return;
    setSelectedPlayer(player);
  };

  const handleNextRound = () => {
    nextRound();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Who added this song?</Text>
        <Text style={styles.songInfo}>
          {currentSong?.songTitle} • {currentSong?.songArtists?.join(', ')}
        </Text>
      </View>

      <ScrollView style={styles.playersContainer}>
        {players.map((player) => (
          <TouchableOpacity
            key={player.username}
            style={[
              styles.playerItem,
              selectedPlayer?.username === player.username && styles.selectedPlayer,
              voteSubmitted && selectedPlayer?.username === player.username && styles.votedPlayer
            ]}
            onPress={() => handleSelectPlayer(player)}
            disabled={voteSubmitted}
          >
            <Image
              source={getProfilePhotoForUser(player.username)}
              style={styles.playerAvatar}
            />
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{player.username}</Text>
              {playerPoints && <Text style={styles.playerPoints}>{playerPoints[player.username] || 0} pts</Text>}
            </View>
            {selectedPlayer?.username === player.username && (
              <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {showVoteResult ? (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>
            {currentSong?.assignedToPlayer?.username === selectedPlayer?.username
              ? 'Correct! +1 point'
              : 'Wrong!'}
          </Text>
          <View style={styles.correctAnswer}>
            <Image
              source={getProfilePhotoForUser(currentSong?.assignedToPlayer?.username)}
              style={styles.resultAvatar}
            />
            <Text style={styles.resultText}>
              This song was added by {currentSong?.assignedToPlayer?.username}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNextRound}
          >
            <Text style={styles.nextButtonText}>Next Round</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={[
              styles.voteButton,
              (!selectedPlayer || voteSubmitted) && styles.disabledButton
            ]}
            onPress={handleVote}
            disabled={!selectedPlayer || voteSubmitted}
          >
            <Text style={styles.voteButtonText}>
              {voteSubmitted ? 'Vote Submitted' : 'Submit Vote'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    marginBottom: 8,
    color: '#333',
    fontWeight: 'bold',
  },
  songInfo: {
    fontSize: 16,
    color: '#666',
  },
  playersContainer: {
    flex: 1,
    marginBottom: 20,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedPlayer: {
    backgroundColor: Colors.lightPrimary,
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  votedPlayer: {
    opacity: 0.7,
  },
  playerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  playerPoints: {
    fontSize: 14,
    color: '#666',
  },
  voteButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  voteButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
  },
  resultContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultTitle: {
    fontSize: 20,
    marginBottom: 16,
    color: '#333',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  correctAnswer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  resultText: {
    fontSize: 16,
    color: '#333',
  },
  nextButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
  },
});
