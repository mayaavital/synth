import React, { useEffect } from "react";
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
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onTimeout) onTimeout();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onTimeout]);
  console.log("player points", playerPoints);
  // Sort players by points (descending)
  //   const sortedPlayers = Array.isArray(players)
  //     ? [...players].sort((a, b) => {
  //         // const aPoints = (playerPoints && playerPoints[a.username]) || 0;
  //         // const bPoints = (playerPoints && playerPoints[b.username]) || 0;
  //         // return bPoints - aPoints;
  //       })
  //     : [];
  const sortedPlayers = [...players].sort((a, b) => {
    const aPoints = playerPoints[a.username] || 0;
    const bPoints = playerPoints[b.username] || 0;
    return bPoints - aPoints;
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.revealTitle}>THE REVEAL</Text>
      <View style={styles.revealSection}>
        <View style={styles.profileCircleWrapper}>
          <View style={styles.profileCircle}>
            <Image
              source={getProfilePhotoForUser(assignedUser?.username)}
              style={styles.profileImage}
            />
          </View>
          <Text style={styles.assignedUserName}>{assignedUser?.username}</Text>
        </View>
        <View style={styles.albumArtWrapper}>
          <Image
            source={{ uri: currentSong?.imageUrl }}
            style={styles.albumArt}
          />
        </View>
      </View>
      <Text style={styles.roundText}>ROUND {currentRound}</Text>
      {/* Player scores section */}
      <View style={styles.scoresContainer}>
        <Text style={styles.scoresTitle}>Player Scores</Text>
        <View style={styles.scoresList}>
          {sortedPlayers.map((player, idx) => (
            <View
              key={player.id}
              style={[styles.scoreItem, idx === 0 && styles.topScorer]}
            >
              <View style={styles.scorePlayerInfo}>
                <Image
                  source={getProfilePhotoForUser(player.username)}
                  style={styles.scorePlayerAvatar}
                />
                <Text style={styles.scorePlayerName}>{player.username}</Text>
              </View>
              <Text style={styles.scoreValue}>
                {playerPoints[player.username] || 0} points
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
    marginLeft: deviceWidth * 0.01,
    fontFamily: "MarkerFelt-Thin",
    letterSpacing: 1.5,
    transform: [{ rotate: "-10deg" }],
  },
  revealSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: deviceHeight * 0.025,
    width: "100%",
    justifyContent: "flex-start",
  },
  profileCircleWrapper: {
    alignItems: "center",
    marginRight: deviceWidth * 0.025,
  },
  profileCircle: {
    width: deviceWidth * 0.22,
    height: deviceWidth * 0.22,
    borderRadius: deviceWidth * 0.11,
    borderWidth: 4,
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
    width: deviceWidth * 0.17,
    height: deviceWidth * 0.17,
    borderRadius: deviceWidth * 0.085,
    resizeMode: "cover",
  },
  assignedUserName: {
    color: "#8E44AD",
    fontSize: deviceWidth * 0.05,
    fontWeight: "bold",
    marginTop: 2,
    transform: [{ rotate: "-20deg" }],
    fontFamily: "MarkerFelt-Thin",
  },
  albumArtWrapper: {
    borderWidth: 4,
    borderColor: "#8E44AD",
    borderRadius: deviceWidth * 0.045,
    marginLeft: deviceWidth * 0.025,
    shadowColor: "#8E44AD",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  albumArt: {
    width: deviceWidth * 0.32,
    height: deviceWidth * 0.32,
    borderRadius: deviceWidth * 0.035,
  },
  roundText: {
    color: "#8E44AD",
    fontSize: deviceWidth * 0.055,
    fontWeight: "bold",
    alignSelf: "flex-end",
    marginRight: deviceWidth * 0.025,
    marginBottom: deviceHeight * 0.02,
    fontFamily: "MarkerFelt-Thin",
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
