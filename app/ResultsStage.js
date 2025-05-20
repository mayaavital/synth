import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";

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
  const router = useRouter();
  const [displayPoints, setDisplayPoints] = useState({});
  
  // Update displayPoints whenever playerPoints or players change
  useEffect(() => {
    console.log("[TRACK_SYNC] Raw player points in results:", playerPoints);
    
    // Check if playerPoints has comprehensive mappings
    if (playerPoints.scoresWithUsernames) {
      console.log("[TRACK_SYNC] Using scoresWithUsernames directly:", playerPoints.scoresWithUsernames);
      setDisplayPoints(playerPoints.scoresWithUsernames);
      return;
    }
    
    // Check if playerPoints has new socketIdToUsername mapping
    if (playerPoints.socketIdToUsername) {
      console.log("[TRACK_SYNC] Using socketIdToUsername mapping from server");
      const newDisplayPoints = {};
      
      // Convert scores using the mapping
      Object.entries(playerPoints.scores || {}).forEach(([socketId, score]) => {
        const username = playerPoints.socketIdToUsername[socketId];
        if (username) {
          newDisplayPoints[username] = score;
          console.log(`[TRACK_SYNC] Mapped ${socketId} to ${username} with score ${score}`);
        }
      });
      
      // Check for any missing players and assign 0 points
      players.filter(player => player && player.username).forEach(player => {
        if (newDisplayPoints[player.username] === undefined) {
          newDisplayPoints[player.username] = 0;
          console.log(`[TRACK_SYNC] Added missing player ${player.username} with 0 points`);
        }
      });
      
      console.log("[TRACK_SYNC] Final scores using socketIdToUsername:", newDisplayPoints);
      setDisplayPoints(newDisplayPoints);
      return;
    }
    
    // Check for traditional playerMappings (backward compatibility)
    if (playerPoints.playerMappings) {
      console.log("[TRACK_SYNC] Using playerMappings provided by server");
      const newDisplayPoints = {};
      
      // Map socket IDs to usernames using the provided mapping
      Object.entries(playerPoints.playerMappings).forEach(([username, socketId]) => {
        if (playerPoints.scores && playerPoints.scores[socketId] !== undefined) {
          newDisplayPoints[username] = playerPoints.scores[socketId];
          console.log(`[TRACK_SYNC] Mapped ${socketId} to ${username} with score ${playerPoints.scores[socketId]}`);
        }
      });
      
      // Check for any missing players and assign 0 points
      players.filter(player => player && player.username).forEach(player => {
        if (newDisplayPoints[player.username] === undefined) {
          newDisplayPoints[player.username] = 0;
          console.log(`[TRACK_SYNC] Added missing player ${player.username} with 0 points`);
        }
      });
      
      console.log("[TRACK_SYNC] Final mapped display points:", newDisplayPoints);
      setDisplayPoints(newDisplayPoints);
      return;
    }
    
    // Fallback to manual mapping if server didn't provide mappings
    
    // Create a direct map of all possible IDs to player usernames
    const allIdToUsername = {};
    
    // Log raw player data for debugging
    console.log("[TRACK_SYNC] Raw player data:", players.map(p => p && {id: p.id, username: p.username}));
    
    // Create comprehensive player mappings both ways
    players.filter(player => player !== undefined).forEach(player => {
      if (!player || !player.username) return;
      
      // Map all forms of IDs to this username
      if (player.id) {
        // Try numeric ID
        allIdToUsername[player.id] = player.username;
        
        // Try string ID
        allIdToUsername[String(player.id)] = player.username;
      }
      
      // Map socket ID-looking strings directly
      if (typeof player.id === 'string' && player.id.length > 10) {
        allIdToUsername[player.id] = player.username;
      }
    });
    
    console.log("[TRACK_SYNC] Complete ID to username mapping:", allIdToUsername);
    
    // Now use this comprehensive mapping to build displayPoints
    const newDisplayPoints = {};
    
    // First, add any direct username matches from playerPoints
    Object.entries(playerPoints).forEach(([key, points]) => {
      // If key is a username, use it directly
      const player = players.find(p => p && p.username === key);
      if (player) {
        newDisplayPoints[key] = points;
        console.log(`[TRACK_SYNC] Direct username match: ${key} = ${points}`);
        return;
      }
      
      // If key is an ID in our mapping, use the username from the mapping
      if (allIdToUsername[key]) {
        const username = allIdToUsername[key];
        newDisplayPoints[username] = points;
        console.log(`[TRACK_SYNC] ID mapped to username: ${key} -> ${username} = ${points}`);
        return;
      }
    });
    
    // Ensure all players have a score (default to 0 if not found)
    players.filter(p => p && p.username).forEach(player => {
      if (newDisplayPoints[player.username] === undefined) {
        newDisplayPoints[player.username] = 0;
        console.log(`[TRACK_SYNC] Assigning default score of 0 to ${player.username}`);
      }
    });
    
    console.log("[TRACK_SYNC] Final display points in results:", newDisplayPoints);
    setDisplayPoints(newDisplayPoints);
  }, [playerPoints, players]);
  
  // Helper function to get points for a player
  const getPointsForPlayer = (player) => {
    if (!player) return 0;
    
    // First check by username in display points
    if (player.username && displayPoints[player.username] !== undefined) {
      return displayPoints[player.username];
    }
    
    // If not found, return 0
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
                {/* {isMultiplayer && (
                  <View style={resultsStyles.ownershipBadge}>
                    <Text style={resultsStyles.ownershipBadgeText}>Owner</Text>
                  </View>
                )} */}
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
            onPress={() => {router.push("/")}}
          >
            <Text style={resultsStyles.returnButtonText}>Back to Home</Text>
          </Pressable>
          <Pressable
            style={resultsStyles.playAgainButton}
            onPress={() => {router.push("/multiplayer-game")}}
          >
            <Text style={resultsStyles.playAgainButtonText}>Start a new game!</Text>
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
    justifyContent: "space-evenly",
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
