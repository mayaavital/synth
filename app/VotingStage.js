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
  allVotesCast,
  socket,
}) => {
  const [voteLocked, setVoteLocked] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [lastProcessedRound, setLastProcessedRound] = useState(0);

  // Map socket IDs to usernames when playerPoints or players change
  useEffect(() => {
    if (
      isMultiplayer &&
      Object.keys(playerPoints || {}).length > 0 &&
      players.length > 0
    ) {
      const updatedPoints = { ...playerPoints };
      let madeChanges = false;

      // Create a comprehensive player mapping
      const playerBySocketId = {};
      const playerByUsername = {};
      const allPlayerIds = new Set();

      // Build complete player mappings
      players
        .filter((player) => player !== undefined)
        .forEach((player) => {
          if (player.id) {
            playerBySocketId[player.id] = player;
            allPlayerIds.add(player.id);

            // Also map string version of ID
            playerBySocketId[String(player.id)] = player;
            allPlayerIds.add(String(player.id));
          }

          if (player.username) {
            playerByUsername[player.username] = player;
          }
        });

      // Create a comprehensive socket ID to username mapping
      const socketIdToUsername = {};
      players
        .filter((player) => player !== undefined)
        .forEach((player) => {
          if (player.id && player.username) {
            socketIdToUsername[player.id] = player.username;
            // Also map string version of ID
            socketIdToUsername[String(player.id)] = player.username;
          }
        });

      console.log(
        "Socket ID to username comprehensive mapping:",
        socketIdToUsername
      );

      // First pass: Map socket IDs to usernames
      Object.keys(playerPoints || {}).forEach((pointKey) => {
        // If this is a socket ID or other non-username identifier
        const player = playerBySocketId[pointKey];
        if (player && player.username) {
          // Map the points to the username
          updatedPoints[player.username] = playerPoints[pointKey];
          console.log(
            `Mapped ID ${pointKey} points to username ${player.username}`
          );
          madeChanges = true;
        }

        // Also check our comprehensive socketIdToUsername mapping
        if (
          socketIdToUsername[pointKey] &&
          !updatedPoints[socketIdToUsername[pointKey]]
        ) {
          updatedPoints[socketIdToUsername[pointKey]] = playerPoints[pointKey];
          console.log(
            `Used socketIdToUsername to map ${pointKey} to ${socketIdToUsername[pointKey]}`
          );
          madeChanges = true;
        }
      });

      // If we made changes, update playerPoints
      if (madeChanges) {
        console.log("Updated player points mapping:", updatedPoints);
        setPlayerPoints(updatedPoints);
      }
    }
  }, [playerPoints, players, isMultiplayer, setPlayerPoints]);

  // Force reset voting state when currentRound changes
  useEffect(() => {
    if (currentRound > lastProcessedRound) {
      console.log(
        `New round detected: ${currentRound}. Resetting voting state...`
      );
      // Reset all voting UI states for new round
      setVoteLocked(false);
      setSelectedPlayer(null);
      setShowVoteResult(false);
      setShowLeaderboard(false);
      setLastProcessedRound(currentRound);

      // Explicitly reset allVotesCast when round changes to prevent premature transitions
      if (allVotesCast) {
        console.log(`Resetting allVotesCast for new round ${currentRound}`);
        setAllVotesCast(false);
      }
    }
  }, [
    currentRound,
    lastProcessedRound,
    setSelectedPlayer,
    setShowVoteResult,
    allVotesCast,
  ]);

  // Listen for events that should reset vote locking
  useEffect(() => {
    if (socket && isMultiplayer) {
      // Listen for vote_reset events from server
      const onVoteReset = (data) => {
        console.log("Vote reset received for round:", data?.round);
        // Reset all voting UI states
        setVoteLocked(false);
        setSelectedPlayer(null);
        setShowVoteResult(false);
        setShowLeaderboard(false);
      };

      // Listen for force_song_sync events which may include votingReset flag
      const onForceSongSync = (data) => {
        if (data?.votingReset) {
          console.log("Force sync with voting reset flag received");
          // Reset all voting UI states
          setVoteLocked(false);
          setSelectedPlayer(null);
          setShowVoteResult(false);
          setShowLeaderboard(false);
        }
      };

      // Listen for round_started which may include votingReset flag
      const onRoundStarted = (data) => {
        console.log("New round started, resetting voting state");
        // Reset all voting UI states
        setVoteLocked(false);
        setSelectedPlayer(null);
        setShowVoteResult(false);
        setShowLeaderboard(false);
      };

      // Explicit event for next round
      const onNextRound = (data) => {
        console.log("Next round event received, resetting voting");
        // Reset all voting UI states for new round
        setVoteLocked(false);
        setSelectedPlayer(null);
        setShowVoteResult(false);
        setShowLeaderboard(false);
      };

      // Register event handlers
      socket.on("vote_reset", onVoteReset);
      socket.on("force_song_sync", onForceSongSync);
      socket.on("round_started", onRoundStarted);
      socket.on("next_round", onNextRound);

      // Cleanup function
      return () => {
        if (socket) {
          socket.off("vote_reset", onVoteReset);
          socket.off("force_song_sync", onForceSongSync);
          socket.off("round_started", onRoundStarted);
          socket.off("next_round", onNextRound);
        }
      };
    }
  }, [socket, isMultiplayer, setSelectedPlayer, setShowVoteResult]);

  // When results are revealed, show leaderboard after 5 seconds
  useEffect(() => {
    if (showVoteResult && !showLeaderboard) {
      const timer = setTimeout(() => {
        setShowLeaderboard(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showVoteResult, showLeaderboard]);

  // Add effect to automatically show result when all votes are cast
  useEffect(() => {
    if (isMultiplayer && allVotesCast && voteLocked && !showVoteResult) {
      console.log(`All votes cast (${currentRound}), showing results!`);

      // Small delay before showing results to ensure smooth transition
      setTimeout(() => {
        setShowVoteResult(true);
      }, 500);
    }
  }, [allVotesCast, voteLocked, showVoteResult, isMultiplayer, currentRound]);

  // Add effect to update UI immediately when allVotesCast changes
  useEffect(() => {
    if (isMultiplayer && allVotesCast && voteLocked) {
      console.log("All votes received, updating UI...");
    }
  }, [allVotesCast, voteLocked, isMultiplayer]);

  // Add additional effect to ensure vote lock is cleared when round changes
  useEffect(() => {
    // Reset voteLocked on round change
    if (currentRound !== lastProcessedRound) {
      setVoteLocked(false);
    }
  }, [currentRound, lastProcessedRound]);

  // Listen for vote_result to update points
  useEffect(() => {
    if (socket && isMultiplayer) {
      const onVoteResult = (data) => {
        if (data && data.scores) {
          console.log(
            `[ROUND ${currentRound}] Vote result received from server:`,
            data
          );

          // Create a new points object based on server data
          let updatedPoints = {};

          // First priority: Use comprehensive username mappings if provided
          if (data.scoresWithUsernames) {
            console.log(
              `[ROUND ${currentRound}] Using scoresWithUsernames provided by server`
            );
            updatedPoints = { ...data.scoresWithUsernames };

            // Log detailed mapping information from server
            if (data.socketIdToUsername) {
              console.log(
                `[ROUND ${currentRound}] Server provided comprehensive socketIdToUsername mapping:`,
                data.socketIdToUsername
              );
            }

            if (data.playerIdToUsername) {
              console.log(
                `[ROUND ${currentRound}] Server provided comprehensive playerIdToUsername mapping:`,
                data.playerIdToUsername
              );
            }

            if (data.usernameToIds) {
              console.log(
                `[ROUND ${currentRound}] Server provided comprehensive usernameToIds mapping:`,
                data.usernameToIds
              );
            }
          }
          // Second priority: Use traditional playerMappings
          else if (data.playerMappings) {
            console.log(
              `[ROUND ${currentRound}] Using playerMappings provided by server`
            );

            // First copy original scores
            updatedPoints = { ...data.scores };

            // Map socket IDs to usernames
            Object.entries(data.playerMappings).forEach(
              ([username, socketId]) => {
                if (data.scores[socketId] !== undefined) {
                  // Add score mapped to username
                  updatedPoints[username] = data.scores[socketId];
                  console.log(
                    `[ROUND ${currentRound}] Mapped ${socketId} to ${username} with score ${data.scores[socketId]}`
                  );
                }
              }
            );
          }
          // Final fallback: Use client-side mapping logic
          else {
            console.log(
              `[ROUND ${currentRound}] No server mappings provided, using client-side mapping`
            );

            // Create comprehensive socket ID to username mapping
            const socketIdToUsername = {};

            // Map players to their socket IDs
            players
              .filter((player) => player !== undefined)
              .forEach((player) => {
                if (player && player.username && player.id) {
                  // Add to mapping
                  socketIdToUsername[player.id] = player.username;

                  // Also add string version if it's a number
                  if (typeof player.id === "number") {
                    socketIdToUsername[String(player.id)] = player.username;
                  }
                }
              });

            console.log(
              `[ROUND ${currentRound}] Client-generated socket ID to username mapping:`,
              socketIdToUsername
            );

            // Combine server scores with our mappings
            updatedPoints = { ...data.scores };

            // Add username-keyed entries for each socket ID we know about
            Object.keys(data.scores).forEach((socketId) => {
              const username = socketIdToUsername[socketId];
              if (username) {
                // Add the same score for the username
                updatedPoints[username] = data.scores[socketId];
                console.log(
                  `[ROUND ${currentRound}] Adding username key ${username} with score ${data.scores[socketId]}`
                );
              }
            });
          }

          // Final validation step: Ensure all players have scores
          players
            .filter((player) => player !== undefined)
            .forEach((player) => {
              if (
                player &&
                player.username &&
                updatedPoints[player.username] === undefined
              ) {
                // If we have no score for this player, set to 0
                updatedPoints[player.username] = 0;
                console.log(
                  `[ROUND ${currentRound}] Adding missing player ${player.username} with default score 0`
                );
              }
            });

          console.log(
            `[ROUND ${currentRound}] Final points from server vote result:`,
            updatedPoints
          );

          // Set the player points using the server's data
          setPlayerPoints(updatedPoints);
        }
      };

      // Register the vote_result event handler
      socket.on("vote_result", onVoteResult);

      return () => {
        socket.off("vote_result", onVoteResult);
      };
    }
  }, [
    socket,
    isMultiplayer,
    players,
    setPlayerPoints,
    playerPoints,
    currentRound,
  ]);

  // Handle vote submission
  const handleSubmitVote = () => {
    if (!selectedPlayer) return;

    // Lock the vote as soon as user submits
    setVoteLocked(true);

    // Find the player object from the username
    const selectedPlayerObj = players
      .filter((p) => p !== undefined)
      .find((p) => p && p.username === selectedPlayer);

    if (!selectedPlayerObj) {
      console.error(
        `Could not find player object for username: ${selectedPlayer}`
      );
      // Even if we can't find the player, keep the vote locked
    }

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

    // Update player songs tracking
    setPlayerSongs((prev) => ({
      ...prev,
      [selectedPlayer]: [...(prev[selectedPlayer] || []), newVote],
    }));

    // Find the current player (the one casting the vote)
    // Use the socket ID to find our player in the players array
    const currentPlayer = players.find((p) => p && p.id === socket?.id);
    const currentUsername = currentPlayer?.username || "Unknown Player";

    // Update points for the current player if they made a correct guess
    if (isCorrectGuess) {
      console.log(
        `Round ${currentRound}: ${currentUsername} made a correct guess and earned a point!`
      );
      console.log(
        `Current player ID: ${currentPlayer?.id}, socket ID: ${socket?.id}`
      );
      console.log(
        `Correct player: ${currentSong?.assignedToPlayer?.username}, ID: ${currentSong?.assignedToPlayer?.id}`
      );

      // Note: We're removing client-side score incrementing as this should come from the server
      // The server is the source of truth for scores and will broadcast updated scores via vote_result events
      console.log(
        `Round ${currentRound}: Correct guess made - waiting for server to update score`
      );
    }

    // In multiplayer mode, send the vote to the server
    if (isMultiplayer) {
      console.log(
        `Round ${currentRound}: Casting vote for ${selectedPlayer} in game ${gameId}`
      );
      try {
        // Send both player ID and username to ensure server can process vote
        if (typeof castVote === "function") {
          // Include as much identifying information as possible
          const votePayload = {
            votedForPlayerId: selectedPlayerObj?.id,
            votedForUsername: selectedPlayer,
            voterUsername: currentUsername,
            voterSocketId: socket?.id,
            voterPlayerId: currentPlayer?.id,
            currentRound: currentRound, // Include round information
          };

          // Log player relationships for debugging
          console.log(`Round ${currentRound}: Vote relationships check:`);
          console.log(
            `- I am ${currentUsername} (ID: ${currentPlayer?.id}, socket: ${socket?.id})`
          );
          console.log(
            `- Voting for ${selectedPlayer} (ID: ${selectedPlayerObj?.id})`
          );
          console.log(
            `- Correct player is ${currentSong?.assignedToPlayer?.username} (ID: ${currentSong?.assignedToPlayer?.id})`
          );

          console.log(
            `Round ${currentRound}: Sending vote with player data:`,
            votePayload
          );
          castVote(gameId, selectedPlayer, votePayload);

          // Important: Don't set allVotesCast here - wait for server to tell us
          console.log(
            `Vote submitted for round ${currentRound}, waiting for other players...`
          );
        } else {
          console.error("castVote is not a function", typeof castVote);
          Alert.alert("Error", "Vote submission function is not available.");
          // Do NOT unlock the vote here - it should stay locked
        }
      } catch (error) {
        console.error("Error casting vote:", error);
        Alert.alert("Error", "Failed to submit your vote. Please try again.");
        // Do NOT unlock the vote even on error - server may have received it
      }
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
    // If player has a displayName, use that for the local avatar
    if (player?.displayName) {
      return getProfilePhotoForUser(player.displayName);
    }
    // Otherwise use the username for the local avatar
    return getProfilePhotoForUser(player?.username);
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
        {players
          .filter((player) => player !== undefined)
          .map((player) => {
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
                key={
                  player.id ||
                  `player-${player.username || Math.random().toString()}`
                }
                style={buttonStyle}
                onPress={() => {
                  if (voteLocked || showVoteResult) return;
                  setSelectedPlayer(player.username);
                }}
              >
                <View style={votingStyles.profileImageContainer}>
                  <View style={votingStyles.profileBackground}>
                    <Image
                      source={getProfileImage(player)}
                      style={votingStyles.profileImage}
                    />
                  </View>
                </View>
                <Text style={votingStyles.playerVoteName}>
                  {getDisplayName(player)}
                </Text>
              </Pressable>
            );
          })}
        {/* Overlay when vote is locked but results not shown 
            Show whenever the player has voted (voteLocked) and we're not showing results yet */}
        {voteLocked && !showVoteResult && (
          <View style={votingStyles.voteLockedOverlay} accessible={true} accessibilityLabel="Vote is locked, waiting for other players">
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
            {allVotesCast ? "Results coming..." : "Waiting for all votes…"}
          </Text>
        </View>
      )}
    </View>
  );
};

export default VotingStage;
