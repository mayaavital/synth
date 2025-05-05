import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Image, Alert } from "react-native";
import { votingStyles } from "../assets/styles/votingStyles";
import LeaderboardScreen from "./LeaderboardScreen";

const VotingStage = ({
  players,
  currentSong,
  currentRound,
  selectedPlayer,
  showVoteResult,
  setSelectedPlayer,
  setShowVoteResult,
  setPlayerSongs,
  setPlayerPoints,
  nextRound,
  getProfilePhotoForUser,
  isMultiplayer,
  gameId,
  castVote,
  playerPoints,
}) => {
  const [voteLocked, setVoteLocked] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // When results are revealed, show leaderboard after 5 seconds
  useEffect(() => {
    if (showVoteResult && !showLeaderboard) {
      const timer = setTimeout(() => {
        setShowLeaderboard(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showVoteResult, showLeaderboard]);

  // Handle vote submission
  const handleSubmitVote = () => {
    if (!selectedPlayer) return;
    setVoteLocked(true);

    // Create the vote record
    const isCorrectGuess =
      selectedPlayer === currentSong?.assignedToPlayer?.username;
    const newVote = {
      round: currentRound,
      songId: currentSong?.songTitle,
      votedFor: selectedPlayer,
      correctPlayer: currentSong?.assignedToPlayer?.username,
      isCorrect: isCorrectGuess,
    };

    // Update player scores tracking
    setPlayerSongs((prev) => ({
      ...prev,
      [selectedPlayer]: [...(prev[selectedPlayer] || []), newVote],
    }));

    // Update points for @cole_sprout if the current user makes a correct guess
    if (isCorrectGuess) {
      setPlayerPoints((prev) => ({
        ...prev,
        "@cole_sprout": (prev["@cole_sprout"] || 0) + 1,
      }));
    }

    //     // Instead of only updating @cole_sprout:
    // if (isCorrectGuess) {
    //     setPlayerPoints((prev) => ({
    //       ...prev,
    //       [selectedPlayer]: (prev[selectedPlayer] || 0) + 1,
    //     }));
    //   }

    // In multiplayer mode, send the vote to the server
    if (isMultiplayer) {
      castVote(gameId, selectedPlayer);
    } else {
      // In single player mode, reveal result immediately
      setShowVoteResult(true);
    }
  };

  // Handler for leaderboard timeout
  const handleLeaderboardTimeout = () => {
    setShowLeaderboard(false);
    setVoteLocked(false);
    setSelectedPlayer(null);
    setShowVoteResult(false);
    nextRound();
  };

  if (showLeaderboard && showVoteResult) {
    console.log("playerPoints", playerPoints);
    return (
      <LeaderboardScreen
        currentSong={currentSong}
        assignedUser={currentSong?.assignedToPlayer}
        currentRound={currentRound}
        players={players}
        playerPoints={playerPoints}
        getProfilePhotoForUser={getProfilePhotoForUser}
        onTimeout={handleLeaderboardTimeout}
      />
    );
  }

  return (
    <View style={votingStyles.votingContainer}>
      <Text style={votingStyles.votingInstructions}>
        Who do you think listened to this song?
      </Text>

      <View style={votingStyles.playersGrid}>
        {players.map((player) => {
          // Determine style based on selection and result
          const isSelected = selectedPlayer === player.username;
          const isCorrect =
            currentSong?.assignedToPlayer?.username === player.username;
          const wasVoted = isSelected && showVoteResult;

          // Determine the button style for dynamic feedback
          let buttonStyle = votingStyles.playerVoteButton;
          if (showVoteResult) {
            if (wasVoted) {
              if (isCorrect) {
                buttonStyle = [
                  votingStyles.playerVoteButton,
                  votingStyles.correctVoteButton,
                ];
              } else {
                buttonStyle = [
                  votingStyles.playerVoteButton,
                  votingStyles.incorrectVoteButton,
                ];
              }
            } else if (isCorrect) {
              // Show correct answer even if not selected
              buttonStyle = [
                votingStyles.playerVoteButton,
                votingStyles.correctVoteButton,
              ];
            }
          } else if (isSelected) {
            buttonStyle = [
              votingStyles.playerVoteButton,
              { borderColor: "#6C3EB6", borderWidth: 3 },
            ];
          }

          return (
            <Pressable
              key={player.id}
              style={buttonStyle}
              onPress={() => {
                if (voteLocked || showVoteResult) return;
                setSelectedPlayer(player.username);
              }}
            >
              <View style={votingStyles.profileImageContainer}>
                <View style={votingStyles.profileBackground}>
                  <Image
                    source={getProfilePhotoForUser(player.username)}
                    style={votingStyles.profileImage}
                  />
                </View>
              </View>
              <Text style={votingStyles.playerVoteName}>{player.username}</Text>
            </Pressable>
          );
        })}
        {/* Overlay when vote is locked but results not shown */}
        {voteLocked && !showVoteResult && (
          <View style={votingStyles.voteLockedOverlay}>
            <View style={votingStyles.lockedMessageContainer}>
              <Text style={votingStyles.lockIcon}>🔒</Text>
              <Text style={votingStyles.lockedMessage}>
                Your vote{"\n"}is locked!
              </Text>
            </View>
          </View>
        )}
      </View>
      {/* Submit button, only show if vote not locked and a player is selected */}
      {!voteLocked && !showVoteResult && selectedPlayer && (
        <Pressable style={votingStyles.submitButton} onPress={handleSubmitVote}>
          <Text style={votingStyles.submitButtonText}>Submit</Text>
        </Pressable>
      )}
      {/* Waiting banner at the bottom */}
      {voteLocked && !showVoteResult && (
        <View style={votingStyles.waitingBanner}>
          <Text style={votingStyles.waitingBannerText}>
            Waiting for all votes…
          </Text>
        </View>
      )}
    </View>
  );
};

export default VotingStage;
