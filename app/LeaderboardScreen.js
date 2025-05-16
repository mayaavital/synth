import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";

const { width: deviceWidth, height: deviceHeight } = Dimensions.get("window");

const LeaderboardScreen = ({
  currentSong,
  assignedUser,
  currentRound,
  players = [],
  playerPoints = {},
  getProfilePhotoForUser,
  onTimeout,
}) => {
  const [displayPoints, setDisplayPoints] = useState({});
  
  // Update displayPoints whenever playerPoints or players change
  useEffect(() => {
    console.log("Raw player points in leaderboard:", playerPoints);
    
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
    
    console.log("Final display points:", newDisplayPoints);
    setDisplayPoints(newDisplayPoints);
  }, [playerPoints, players]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (onTimeout) onTimeout();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onTimeout]);
  
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
    <ScrollView contentContainerStyle={styles.container}>
      {/* <Text style={styles.revealTitle}>THE REVEAL</Text> */}
      <View style={styles.revealSection}>
        <View style={styles.albumArtWrapper}>
          <Image
            source={{ uri: currentSong?.imageUrl }}
            style={styles.albumArt}
          />
        </View>
        <View style={styles.profileCircleWrapper}>
          <View style={styles.profileCircle}>
            <Image
              source={assignedUser ? getProfileImage(assignedUser) : getProfilePhotoForUser("Unknown")}
              style={styles.profileImage}
            />
          </View>
          <Text style={styles.assignedUserName}>
            {assignedUser ? getDisplayName(assignedUser) : "Unknown Player"}
          </Text>
        </View>
      </View>
      <Text style={styles.roundText}>ROUND {currentRound}</Text>
      {/* Player scores section */}
      <View style={styles.scoresContainer}>
        <Text style={styles.scoresTitle}>Leaderboard</Text>
        <View style={styles.scoresList}>
          {sortedPlayers.map((player, idx) => (
            <View
              key={player.id || `player-${idx}`}
              style={[styles.scoreItem, idx === 0 && styles.topScorer]}
            >
              <View style={styles.scorePlayerInfo}>
                <Image
                  source={getProfileImage(player)}
                  style={styles.scorePlayerAvatar}
                />
                <Text style={styles.scorePlayerName}>{getDisplayName(player)}</Text>
              </View>
              <Text style={styles.scoreValue}>
                {getPointsForPlayer(player)} points
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    padding: deviceWidth * 0.05,
    paddingTop: deviceHeight * 0.05,
  },
  revealTitle: {
    color: "#8E44AD",
    fontSize: deviceWidth * 0.08,
    fontWeight: "bold",
    alignSelf: "flex-start",
    marginBottom: deviceHeight * 0.01,
    marginLeft: deviceWidth * 0.02,
    //fontFamily: "MarkerFelt-Thin",
    letterSpacing: 1.5,
    //transform: [{ rotate: "-10deg" }],
  },
  revealSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: deviceHeight * 0.025,
    width: "100%",
    justifyContent: "center",
  },
  profileCircleWrapper: {
    alignItems: "center",
    // marginRight: deviceWidth * 0.025,
    position: "absolute",
    left: deviceWidth * 0.025,
    bottom: deviceHeight * -0.06,
  },
  profileCircle: {
    width: deviceWidth * 0.2,
    height: deviceWidth * 0.2,
    borderRadius: 500,
    borderWidth: 1,
    borderColor: "#8E44AD",
    backgroundColor: "#232323",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: deviceHeight * 0.01,
    shadowColor: "#8E44AD",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 10,
  },
  profileImage: {
    width: deviceWidth * 0.2,
    height: deviceWidth * 0.2,
    borderRadius: deviceWidth * 0.085,
    resizeMode: "cover",
  },
  assignedUserName: {
    color: "#8E44AD",
    fontSize: deviceWidth * 0.05,
    transform: [{ rotate: "-10deg" }],
    //fontFamily: "MarkerFelt-Thin",
  },
  albumArtWrapper: {
    borderWidth: 1,
    borderColor: "#8E44AD",
    borderRadius: deviceWidth * 0.045,
    //marginLeft: deviceWidth * 0.025,
    shadowColor: "#8E44AD",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  albumArt: {
    width: deviceWidth * 0.6,
    height: deviceWidth * 0.6,
    borderRadius: deviceWidth * 0.035,
  },
  roundText: {
    color: "#8E44AD",
    fontSize: deviceWidth * 0.055,
    fontWeight: "bold",
    alignSelf: "flex-end",
    // marginRight: deviceWidth * 0.025,
    marginBottom: deviceHeight * 0.02,
    //fontFamily: "MarkerFelt-Thin",
    transform: [{ rotate: "8deg" }],
  },
  scoresContainer: {
    width: "100%",
    backgroundColor: "#232323",
    borderRadius: deviceWidth * 0.04,
    padding: deviceWidth * 0.04,
    marginTop: deviceHeight * 0.01,
    marginBottom: deviceHeight * 0.025,
  },
  scoresTitle: {
    color: "#FFC857",
    fontSize: deviceWidth * 0.045,
    fontWeight: "bold",
    marginBottom: deviceHeight * 0.01,
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
    borderRadius: deviceWidth * 0.03,
    padding: deviceWidth * 0.03,
    marginBottom: deviceHeight * 0.01,
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
    width: deviceWidth * 0.1,
    height: deviceWidth * 0.1,
    borderRadius: deviceWidth * 0.05,
    marginRight: deviceWidth * 0.025,
  },
  scorePlayerName: {
    color: "white",
    fontSize: deviceWidth * 0.045,
    fontWeight: "500",
  },
  scoreValue: {
    color: "#FFC857",
    fontSize: deviceWidth * 0.05,
    fontWeight: "bold",
  },
});

export default LeaderboardScreen;
