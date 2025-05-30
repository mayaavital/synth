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
    console.log("[LEADERBOARD] Raw player points:", playerPoints);
    console.log("[LEADERBOARD] Players:", players.map(p => p && { id: p.id, username: p.username }));

    // Since processPlayerPointsUpdate in game-play.js already converts scores to username-based keys,
    // we can use playerPoints directly
    const newDisplayPoints = {};
    
    // Ensure all players have a score entry (default to 0)
    players
      .filter(p => p && p.username)
      .forEach((player) => {
        newDisplayPoints[player.username] = playerPoints[player.username] || 0;
      });

    console.log("[LEADERBOARD] Final display points:", newDisplayPoints);
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
  const sortedPlayers = [...players]
    .filter((player) => player !== undefined)
    .sort((a, b) => {
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
    if (player?.profilePicture) {
      // Handle both direct URL strings and nested profilePicture objects
      const profilePic =
        typeof player.profilePicture === "string"
          ? player.profilePicture
          : player.profilePicture?.profilePicture;

      if (profilePic) {
        return { uri: profilePic };
      }
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
              source={
                assignedUser
                  ? getProfileImage(assignedUser)
                  : getProfilePhotoForUser("Unknown")
              }
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
                <Text style={styles.scorePlayerName}>
                  {getDisplayName(player)}
                </Text>
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
