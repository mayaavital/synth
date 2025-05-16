import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";

const ResultsStage = ({
  players,
  playerPoints,
  roundSongs,
  getProfilePhotoForUser,
  handleReturnToLobby,
  handlePlayAgain,
  currentRound,
  trackAssignments,
  isMultiplayer,
}) => {
  const [displayPoints, setDisplayPoints] = useState({});
  
  // Update displayPoints whenever playerPoints or players change
  useEffect(() => {
    console.log("Raw player points in results:", playerPoints);
    
    // Create a map from socket ID to player object
    const playerMap = {};
    const usernameMap = {};
    const playerIdKeys = new Set();
    const socketIdMap = {}; // Direct socket ID to username mapping
    
    // Log raw player data for debugging
    console.log("Raw player data:", players.map(p => p && {id: p.id, username: p.username}));
    
    players.filter(player => player !== undefined).forEach(player => {
      if (player.id) {
        playerMap[player.id] = player;
        playerIdKeys.add(player.id);
        
        // Also map by string representation of ID to catch numeric IDs
        playerMap[String(player.id)] = player;
        playerIdKeys.add(String(player.id));
        
        if (player.username) {
          usernameMap[player.username] = player;
          
          // Check if this might be a socket ID (long string)
          if (typeof player.id === 'string' && player.id.length > 10) {
            socketIdMap[player.id] = player.username;
          }
        }
      }
    });
    
    console.log("Player ID mapping:", Object.keys(playerMap).join(", "));
    console.log("Username mapping:", Object.keys(usernameMap).join(", "));
    console.log("Socket ID mapping:", JSON.stringify(socketIdMap));
    
    // Create display points mapping
    const newDisplayPoints = {};
    
    // First approach: Direct mapping using player usernames
    players.filter(p => p?.username).forEach(player => {
      // Look for points by player's ID
      if (player.id && playerPoints[player.id] !== undefined) {
        newDisplayPoints[player.username] = playerPoints[player.id];
        console.log(`Found points for player by ID: ${player.username} = ${playerPoints[player.id]}`);
      }
      
      // Also look for points by username directly
      if (playerPoints[player.username] !== undefined) {
        newDisplayPoints[player.username] = playerPoints[player.username];
        console.log(`Found points for player by username: ${player.username} = ${playerPoints[player.username]}`);
      }
    });
    
    // If we have any unmapped scores, try additional approaches
    if (Object.keys(newDisplayPoints).length < Object.keys(playerPoints).length) {
      console.log("Attempting to map remaining scores...");
      
      // Try to map any socket IDs
      Object.keys(playerPoints).forEach(pointKey => {
        // Skip if we've already identified this key
        if (newDisplayPoints[pointKey] !== undefined) return;
        
        // Check if this looks like a socket ID (long string)
        if (typeof pointKey === 'string' && pointKey.length > 10) {
          // Look for a player with this ID
          const playerWithId = players.find(p => p?.id === pointKey);
          if (playerWithId?.username) {
            newDisplayPoints[playerWithId.username] = playerPoints[pointKey];
            console.log(`Mapped score from socket ID ${pointKey} to username ${playerWithId.username}`);
            return;
          }
          
          // As a fallback, try to match with position in array
          // First player's socket ID -> first player's username
          if (Object.keys(newDisplayPoints).length === 0 && players.length > 0 && players[0]?.username) {
            newDisplayPoints[players[0].username] = playerPoints[pointKey];
            console.log(`Position-based fallback mapping: ${pointKey} -> ${players[0].username}`);
            return;
          }
          
          // Second player's socket ID -> second player's username
          if (Object.keys(newDisplayPoints).length === 1 && players.length > 1 && players[1]?.username) {
            newDisplayPoints[players[1].username] = playerPoints[pointKey];
            console.log(`Position-based fallback mapping: ${pointKey} -> ${players[1].username}`);
            return;
          }
          
          // If all else fails, just keep the socket ID as the key
          newDisplayPoints[pointKey] = playerPoints[pointKey];
          console.log(`Keeping socket ID as key: ${pointKey} = ${playerPoints[pointKey]}`);
        }
      });
    }
    
    // If we still have fewer mapped points than total points, try to match by position
    if (Object.keys(newDisplayPoints).length < Object.keys(playerPoints).length && players.length > 0) {
      console.log("Using positional fallback for remaining points...");
      
      // Get unmapped point keys
      const unmappedKeys = Object.keys(playerPoints).filter(key => 
        !Object.keys(newDisplayPoints).includes(key) && 
        !players.some(p => p?.username === key)
      );
      
      // Get players without points
      const unmappedPlayers = players.filter(p => 
        p?.username && !Object.keys(newDisplayPoints).includes(p.username)
      );
      
      // Map them in order
      unmappedKeys.forEach((key, index) => {
        if (index < unmappedPlayers.length) {
          const player = unmappedPlayers[index];
          newDisplayPoints[player.username] = playerPoints[key];
          console.log(`Positional mapping: ${key} -> ${player.username} = ${playerPoints[key]}`);
        }
      });
    }
    
    // If we still have no mappings, use a really aggressive approach by usernames
    if (Object.keys(newDisplayPoints).length === 0 && players.length > 0) {
      console.log("Using aggressive username-only mapping...");
      
      // Make a copy of players that we can sort and manipulate
      const sortedPlayers = [...players].filter(p => p?.username);
      
      // Sort point keys by value (highest first)
      const sortedPointKeys = Object.keys(playerPoints).sort((a, b) => 
        playerPoints[b] - playerPoints[a]
      );
      
      // Map in order of highest score
      sortedPointKeys.forEach((key, index) => {
        if (index < sortedPlayers.length) {
          const player = sortedPlayers[index];
          newDisplayPoints[player.username] = playerPoints[key];
          console.log(`Score-based mapping: ${key} -> ${player.username} = ${playerPoints[key]}`);
        }
      });
    }
    
    console.log("Final display points in results:", newDisplayPoints);
    setDisplayPoints(newDisplayPoints);
  }, [playerPoints, players]);
  
  // Helper function to get points for a player
  const getPointsForPlayer = (player) => {
    if (!player) return 0;
    
    // First check by username in display points
    if (player.username && displayPoints[player.username] !== undefined) {
      return displayPoints[player.username];
    }
    
    // Then try direct lookup in raw player points
    if (player.username && playerPoints[player.username] !== undefined) {
      return playerPoints[player.username];
    }
    
    // Check by player ID
    if (player.id && playerPoints[player.id] !== undefined) {
      return playerPoints[player.id];
    }
    
    // Not found, return 0
    return 0;
  };

  // Sort players by points (descending)
  const sortedPlayers = [...players].filter(player => player !== undefined).sort((a, b) => {
    const aPoints = getPointsForPlayer(a);
    const bPoints = getPointsForPlayer(b);
    return bPoints - aPoints;
  });

  // Helper function to get the appropriate display name for a player
  const getDisplayName = (player) => {
    return player.displayName || player.username || "Unknown Player";
  };

  // Helper function to get the appropriate profile image for a player
  const getProfileImage = (player) => {
    // If player has a Spotify profile picture, use that first
    if (player.profilePicture) {
      return { uri: player.profilePicture };
    }
    // Otherwise use the local avatar based on username
    return getProfilePhotoForUser(player.username);
  };

  return (
    <ScrollView contentContainerStyle={resultsStyles.resultsScrollContent}>
      <View style={resultsStyles.resultsContainer}>
        <Text style={resultsStyles.resultsTitle}>Game Complete!</Text>
        <View style={resultsStyles.gameStats}>
          <Text style={resultsStyles.gameStatsHeader}></Text>
          <Text style={resultsStyles.gameStatLine}>
            Players: {players.filter(p => p?.username).map((p) => getDisplayName(p)).join(", ")}
          </Text>
          <Text style={resultsStyles.gameStatLine}>
            Songs played: {currentRound}
          </Text>
          <Text style={resultsStyles.gameStatLine}>
            Game type: {isMultiplayer ? "Multiplayer" : "Single Player"}
          </Text>
        </View>
        {/* Player scores section */}
        <View style={resultsStyles.scoresContainer}>
          <Text style={resultsStyles.scoresTitle}>Final Scores</Text>
          <View style={resultsStyles.scoresList}>
            {sortedPlayers.map((player, idx) => (
              <View
                key={player.id || `player-${idx}`}
                style={[
                  resultsStyles.scoreItem,
                  idx === 0 && resultsStyles.topScorer,
                ]}
              >
                <View style={resultsStyles.scorePlayerInfo}>
                  <Image
                    source={getProfileImage(player)}
                    style={resultsStyles.scorePlayerAvatar}
                  />
                  <Text style={resultsStyles.scorePlayerName}>
                    {getDisplayName(player)}
                  </Text>
                </View>
                <Text style={resultsStyles.scoreValue}>
                  {getPointsForPlayer(player)} points
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={resultsStyles.reviewListContainer}>
          <Text style={resultsStyles.reviewListTitle}>
            Who listened to what?
          </Text>
          {Object.keys(roundSongs).map((round) => {
            const assignedPlayer = roundSongs[round].assignedToPlayer;
            return (
            <View key={round} style={resultsStyles.reviewListItem}>
              <Image
                source={{ uri: roundSongs[round].imageUrl }}
                style={resultsStyles.reviewSongImage}
              />
              <View style={resultsStyles.reviewSongInfo}>
                <Text style={resultsStyles.reviewSongTitle}>
                  {roundSongs[round].songTitle}
                </Text>
                <Text style={resultsStyles.reviewSongArtist}>
                  {roundSongs[round].songArtists.join(", ")}
                </Text>
              </View>
              <View style={resultsStyles.reviewPlayerInfo}>
                <View style={resultsStyles.reviewPlayerAvatarWrapper}>
                  <Image
                    source={assignedPlayer ? 
                      getProfileImage(assignedPlayer) : 
                      getProfilePhotoForUser("")}
                    style={resultsStyles.reviewPlayerAvatar}
                  />
                </View>
                <Text style={resultsStyles.reviewPlayerName}>
                  {assignedPlayer ? getDisplayName(assignedPlayer) : "Unknown"}
                </Text>
                {isMultiplayer && (
                  <View style={resultsStyles.ownershipBadge}>
                    <Text style={resultsStyles.ownershipBadgeText}>Owner</Text>
                  </View>
                )}
              </View>
            </View>
          )})}
        </View>
        {isMultiplayer && (
          <View style={resultsStyles.pointsExplanationContainer}>
            <Text style={resultsStyles.pointsExplanationTitle}>
              How Points Were Earned
            </Text>
            <Text style={resultsStyles.pointsExplanationText}>
              • 1 point for correctly guessing song owners
            </Text>
          </View>
        )}
        <View style={resultsStyles.buttonsContainer}>
          <Pressable
            style={resultsStyles.returnButton}
            onPress={handleReturnToLobby}
          >
            <Text style={resultsStyles.returnButtonText}>Return to Lobby</Text>
          </Pressable>
          <Pressable
            style={resultsStyles.playAgainButton}
            onPress={handlePlayAgain}
          >
            <Text style={resultsStyles.playAgainButtonText}>Play Again</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
};

export default ResultsStage;

const resultsStyles = StyleSheet.create({
  resultsContainer: {
    padding: 20,
    alignItems: "center",
    width: "100%",
  },
  resultsTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
  },
  gameStats: {
    marginBottom: 30,
  },
  gameStatsHeader: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  gameStatLine: {
    color: "white",
    fontSize: 16,
  },
  scoresContainer: {
    width: "100%",
    backgroundColor: "#232323",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  scoresTitle: {
    color: "#FFC857",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  scoresList: {
    width: "100%",
  },
  scoreItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#282828",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#444",
  },
  topScorer: {
    shadowColor: "#8E44AD",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 12,
    borderColor: "#8E44AD",
    borderWidth: 2,
  },
  scorePlayerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  scorePlayerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  scorePlayerName: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  scoreValue: {
    color: "#FFC857",
    fontSize: 18,
    fontWeight: "bold",
  },
  reviewListContainer: {
    width: "100%",
    backgroundColor: "#232323",
    borderRadius: 16,
    padding: 16,
    marginBottom: 30,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  reviewListTitle: {
    color: "#FFC857",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  reviewListItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#282828",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  reviewSongImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#444",
  },
  reviewSongInfo: {
    flex: 1,
    justifyContent: "center",
  },
  reviewSongTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  reviewSongArtist: {
    color: "#AAA",
    fontSize: 14,
  },
  reviewPlayerInfo: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 100,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  reviewPlayerAvatarWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
    overflow: "hidden",
  },
  reviewPlayerAvatar: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  reviewPlayerName: {
    color: "#FFC857",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginTop: 20,
  },
  returnButton: {
    backgroundColor: "#333",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  returnButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  playAgainButton: {
    backgroundColor: "#8E44AD",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  playAgainButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  resultsScrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  pointsExplanationContainer: {
    width: "100%",
    backgroundColor: "#232323",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  pointsExplanationTitle: {
    color: "#FFC857",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  pointsExplanationText: {
    color: "white",
    fontSize: 16,
  },
  ownershipBadge: {
    backgroundColor: "#8E44AD",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginLeft: 10,
  },
  ownershipBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
});
