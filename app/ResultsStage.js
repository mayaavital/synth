import React from "react";
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
}) => {
  // Sort players by points (descending)
  const sortedPlayers = [...players].sort((a, b) => {
    const aPoints = playerPoints[a.username] || 0;
    const bPoints = playerPoints[b.username] || 0;
    return bPoints - aPoints;
  });

  return (
    <ScrollView contentContainerStyle={resultsStyles.resultsScrollContent}>
      <View style={resultsStyles.resultsContainer}>
        <Text style={resultsStyles.resultsTitle}>Game Complete!</Text>
        <View style={resultsStyles.gameStats}>
          <Text style={resultsStyles.gameStatsHeader}></Text>
          <Text style={resultsStyles.gameStatLine}>
            Players: {players.map((p) => p.username).join(", ")}
          </Text>
          <Text style={resultsStyles.gameStatLine}>
            Songs played: {currentRound}
          </Text>
          <Text style={resultsStyles.gameStatLine}>
            Game type: Guess The Listener
          </Text>
        </View>
        {/* Player scores section */}
        <View style={resultsStyles.scoresContainer}>
          <Text style={resultsStyles.scoresTitle}>Player Scores</Text>
          <View style={resultsStyles.scoresList}>
            {sortedPlayers.map((player, idx) => (
              <View
                key={player.id}
                style={[
                  resultsStyles.scoreItem,
                  idx === 0 && resultsStyles.topScorer,
                ]}
              >
                <View style={resultsStyles.scorePlayerInfo}>
                  <Image
                    source={getProfilePhotoForUser(player.username)}
                    style={resultsStyles.scorePlayerAvatar}
                  />
                  <Text style={resultsStyles.scorePlayerName}>
                    {player.username}
                  </Text>
                </View>
                <Text style={resultsStyles.scoreValue}>
                  {playerPoints[player.username] || 0} points
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={resultsStyles.reviewListContainer}>
          <Text style={resultsStyles.reviewListTitle}>
            Who listened to what?
          </Text>
          {Object.keys(roundSongs).map((round) => (
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
                    source={getProfilePhotoForUser(
                      roundSongs[round].assignedToPlayer?.username || ""
                    )}
                    style={resultsStyles.reviewPlayerAvatar}
                  />
                </View>
                <Text style={resultsStyles.reviewPlayerName}>
                  {roundSongs[round].assignedToPlayer?.username}
                </Text>
              </View>
            </View>
          ))}
        </View>
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
    alignItems: "center",
    marginLeft: 10,
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
});
