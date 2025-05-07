const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');


var admin = require("firebase-admin");
var {GameDataBranches, UserDataBranches, DATABASE_BRANCHES, GAME_TREE} = require('./database-branches');

var serviceAccount = require("./synth-database-firebase-adminsdk-fbsvc-b707949a55.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://synth-database-default-rtdb.firebaseio.com/"
});

// As an admin, the app has access to read and write all data, regardless of Security Rules
var db = admin.database();

// Initialize Express and HTTP server
const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));
const server = http.createServer(app);

// Initialize Socket.io with more detailed configuration
const io = new Server(server, {
  cors: {
    origin: '*', // Allow connections from any origin
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  maxHttpBufferSize: 1e8, // Increase buffer size for larger payloads (100 MB) - fixes serialization issues
  transports: ['websocket', 'polling'], // Support both WebSocket and long-polling
  pingInterval: 10000, // Ping every 10 seconds
  pingTimeout: 5000,   // Consider connection closed if no response after 5 seconds
  cookie: false,       // Don't use cookies for session tracking
  connectTimeout: 15000 // Allow more time for initial connection (15 seconds)
});

// Store active games
const activeGames = {};

// Generate a simple game code (4-6 alphanumeric characters)
function generateSimpleGameCode() {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar-looking characters (0/O, 1/I)
  const codeLength = 4; // Short enough to be easy to type, long enough to avoid collisions
  let code = '';
  
  for (let i = 0; i < codeLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  
  return code;
}

// Export the function for testing
module.exports = {
  generateSimpleGameCode
};

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);
  console.log(`Connection details: ${JSON.stringify({
    transport: socket.conn.transport.name,
    address: socket.handshake.address,
    headers: socket.handshake.headers
  }, null, 2)}`);

  // Handle creating a game
  socket.on('create_game', (gameData) => {

    /*
    Luke: I changed the old "gameID" to "gameInviteCode" because the database might delete an old game's data if theres a duplicate code that
    is in the database but not in the active game list.
    */

    // Generate a simple game code instead of using timestamp
    let gameInviteCode = generateSimpleGameCode();
    
    // Make sure the game code is unique
    while (activeGames[gameInviteCode]) {
      gameInviteCode = generateSimpleGameCode();
    }

    const gameName = gameData.gameName || 'Untitled Game';


    var gameRef = db.ref(DATABASE_BRANCHES.GAMES).child(GAME_TREE.GAMES);

    console.log("Game Name: " + gameName);

    var gamePush = gameRef.push({
      [GameDataBranches.METADATA.NAME] : gameName
    });

    var gameId = gamePush.key;

    console.log("Game ID: " + gameId);

    var inviteCodeRef = db.ref(DATABASE_BRANCHES.GAMES).child(GAME_TREE.INVITE_CODE).child(gameInviteCode);
    inviteCodeRef.set(gameId);
    
    
    //TODO: change the id in this case to be the actual gameID and add a different
    //  field for the invite code. We can talk more about this when were together.
    
    // Create game room with the simple code (not prefixed with "game-")
    activeGames[gameId] = {
      id: gameInviteCode,
      name: gameName,
      host: socket.id,
      players: [{ id: socket.id, username: gameData.hostUsername || 'Host', ready: true }],
      status: 'waiting',
      currentRound: 0,
      maxRounds: gameData.maxRounds || 3,
      currentSong: null,
      roundSongs: {},
      votes: {},
      scores: {}
    };
    
    socket.join(gameId);
    console.log(`Game created: ${gameId} by ${socket.id}`);
    
    // Emit game created event
    socket.emit('game_created', { gameId, game: activeGames[gameId] });
  });

  // Handle joining a game
  socket.on('join_game', async (data) => {
    const { gameId, username } = data;

    //The gameID is the invite code, so we need to translate it to the actual gameID
    //This will look up the gameID from the invite code branch in firebase and return it
    var translateRef = db.ref(DATABASE_BRANCHES.GAMES).child(GAME_TREE.INVITE_CODE).child(gameId);
    const actualGameId = await translateRef.once('value');
    if (!actualGameId) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    
    if (!activeGames[actualGameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    // Check if game is full
    if (activeGames[actualGameId].players.length >= 7) {
      socket.emit('error', { message: 'Game is full' });
      return;
    }
    
    // Check if a player with this username already exists in the game
    const existingPlayerIndex = activeGames[actualGameId].players.findIndex(p => p.username === username);
    
    if (existingPlayerIndex !== -1) {
      // Player with this username already exists
      // Update their socket ID instead of adding a duplicate
      const oldSocketId = activeGames[actualGameId].players[existingPlayerIndex].id;
      
      // Update the player's socket ID
      activeGames[actualGameId].players[existingPlayerIndex].id = socket.id;
      
      // Update the player's score entry
      if (activeGames[actualGameId].scores[oldSocketId] !== undefined) {
        activeGames[actualGameId].scores[socket.id] = activeGames[actualGameId].scores[oldSocketId];
        delete activeGames[actualGameId].scores[oldSocketId];
      } else {
        activeGames[actualGameId].scores[socket.id] = 0;
      }
      
      // If this player was the host, update the host reference
      if (activeGames[actualGameId].host === oldSocketId) {
        activeGames[actualGameId].host = socket.id;
      }
      
      socket.join(actualGameId);
      console.log(`Player reconnected: ${username} to game ${actualGameId} (replaced socket ID ${oldSocketId} with ${socket.id})`);
      
      // Notify everyone in the room about the updated game state
      io.to(actualGameId).emit('player_joined', {
        game: activeGames[actualGameId],
        newPlayer: { id: socket.id, username }
      });
    } else {
      // Add new player to game
      activeGames[actualGameId].players.push({
        id: socket.id,
        username,
        ready: false
      });
      
      socket.join(actualGameId);
      console.log(`Player joined: ${username} to game ${actualGameId}`);
      
      // Initialize score for new player
      activeGames[actualGameId].scores[socket.id] = 0;
      
      // Notify everyone in the room about the new player
      io.to(actualGameId).emit('player_joined', {
        game: activeGames[actualGameId],
        newPlayer: { id: socket.id, username }
      });
    }
  });


  /*
  This code should work as implemented, the only thing we need to change is the actual gameID being sent to the
  websocket instead of the invite code.
  */
  // Handle player ready status
  socket.on('player_ready', (data) => {
    const { gameId } = data;
    
    if (!activeGames[gameId]) return;
    
    // Find player and update ready status
    const playerIndex = activeGames[gameId].players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      activeGames[gameId].players[playerIndex].ready = true;
      
      // Check if all players are ready
      const allReady = activeGames[gameId].players.every(p => p.ready);
      
      // Broadcast updated game state
      io.to(gameId).emit('game_updated', { game: activeGames[gameId], allReady });
      
      if (allReady && activeGames[gameId].status === 'waiting') {
        // Start the game if all players are ready
        activeGames[gameId].status = 'playing';
        io.to(gameId).emit('game_started', { game: activeGames[gameId] });
      }
    }
  });

  /*
  This code should work as implemented, the only thing we need to change is the actual gameID being sent to the
  websocket instead of the invite code.
  */
  // Handle game start
  socket.on('start_game', (data) => {
    const { gameId } = data;
    
    if (!activeGames[gameId] || activeGames[gameId].host !== socket.id) {
      socket.emit('error', { message: 'Not authorized to start the game' });
      return;
    }
    
    activeGames[gameId].status = 'playing';
    activeGames[gameId].currentRound = 1;
    
    // Broadcast game start to all players
    io.to(gameId).emit('game_started', { game: activeGames[gameId] });
  });

  // Handle song selection for a round
  socket.on('select_song', (data) => {
    const { gameId, song, assignedPlayer } = data;
    
    // Validate the data
    if (!gameId || !song || !assignedPlayer) {
      console.error('Invalid data for select_song:', { gameId, song: !!song, assignedPlayer: !!assignedPlayer });
      socket.emit('error', { message: 'Invalid song selection data' });
      return;
    }
    
    // Make sure the game exists
    if (!activeGames[gameId]) {
      console.error(`Game ${gameId} not found for song selection`);
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    // Verify permissions (only host can select songs)
    if (activeGames[gameId].host !== socket.id) {
      console.error(`Non-host socket ${socket.id} attempted to select song for game ${gameId}`);
      socket.emit('error', { message: 'Not authorized to select songs' });
      return;
    }
    
    try {
      // Get the current round
      const currentRound = activeGames[gameId].currentRound;
      
      // Sanitize the song data to prevent circular references and reduce payload size
      const sanitizedSong = {
        songTitle: song.songTitle || 'Unknown Song',
        songArtists: Array.isArray(song.songArtists) ? song.songArtists : [],
        albumName: song.albumName || '',
        imageUrl: song.imageUrl || '',
        duration: song.duration || 0,
        previewUrl: song.previewUrl || '',
        uri: song.uri || null,
        externalUrl: song.externalUrl || null,
        trackId: song.trackId || null
      };
      
      // Sanitize the player assignment
      const sanitizedPlayer = {
        username: assignedPlayer.username || 'Unknown Player',
        id: assignedPlayer.id || 'unknown'
      };
      
      // Update game state
      activeGames[gameId].currentSong = sanitizedSong;
      activeGames[gameId].roundSongs[currentRound] = {
        ...sanitizedSong,
        assignedToPlayer: sanitizedPlayer
      };
      
      // Log the selection (limited to prevent console flooding)
      console.log(`Game ${gameId}, Round ${currentRound}: Song "${sanitizedSong.songTitle}" assigned to ${sanitizedPlayer.username}`);
      console.log(`Song has preview URL: ${!!sanitizedSong.previewUrl}`);
      
      // Broadcast the song to all players
      io.to(gameId).emit('song_selected', {
        round: currentRound,
        song: sanitizedSong,
        assignedPlayer: sanitizedPlayer
      });
    } catch (error) {
      console.error('Error processing song selection:', error);
      socket.emit('error', { message: 'Error processing song selection' });
    }
  });

  /*
  This code should work as implemented, the only thing we need to change is the actual gameID being sent to the
  websocket instead of the invite code.
  */
  // Handle player votes
  socket.on('cast_vote', (data) => {
    const { gameId, votedForUsername } = data;
    
    if (!activeGames[gameId]) return;
    
    // Record the vote
    const currentRound = activeGames[gameId].currentRound;
    if (!activeGames[gameId].votes[currentRound]) {
      activeGames[gameId].votes[currentRound] = {};
    }
    
    activeGames[gameId].votes[currentRound][socket.id] = votedForUsername;
    
    // Check if this is a correct vote
    const correctPlayer = activeGames[gameId].roundSongs[currentRound]?.assignedToPlayer;
    const isCorrect = correctPlayer && correctPlayer.username === votedForUsername;
    
    // Update score if correct
    if (isCorrect) {
      activeGames[gameId].scores[socket.id] = (activeGames[gameId].scores[socket.id] || 0) + 1;
    }
    
    // Send vote result to the player who voted
    socket.emit('vote_result', {
      isCorrect,
      correctPlayer,
      votedFor: votedForUsername
    });
    
    // Check if all players have voted
    const playerCount = activeGames[gameId].players.length;
    const voteCount = Object.keys(activeGames[gameId].votes[currentRound] || {}).length;
    
    if (voteCount >= playerCount) {
      // All players have voted - broadcast round results
      io.to(gameId).emit('round_complete', {
        round: currentRound,
        votes: activeGames[gameId].votes[currentRound],
        scores: activeGames[gameId].scores,
        correctPlayer: correctPlayer
      });
    } else {
      // Just update other players about the vote (not the result)
      socket.to(gameId).emit('player_voted', {
        playerId: socket.id,
        round: currentRound
      });
    }
  });

  /*
  This code should work as implemented, the only thing we need to change is the actual gameID being sent to the
  websocket instead of the invite code.
  */
  // Handle advancing to next round
  socket.on('next_round', (data) => {
    const { gameId } = data;
    
    if (!activeGames[gameId] || activeGames[gameId].host !== socket.id) return;
    
    const currentRound = activeGames[gameId].currentRound;
    const maxRounds = activeGames[gameId].maxRounds;
    
    if (currentRound < maxRounds) {
      // Advance to next round
      activeGames[gameId].currentRound++;
      
      // Reset current song
      activeGames[gameId].currentSong = null;
      
      // Broadcast next round
      io.to(gameId).emit('round_started', {
        round: activeGames[gameId].currentRound,
        game: activeGames[gameId]
      });
    } else {
      // Game complete
      activeGames[gameId].status = 'completed';

      /*
      Send our completed game data to the database
      */
      var gameRef = db.ref(DATABASE_BRANCHES.GAMES).child(GAME_TREE.GAMES).child(gameId);
      var metaRef = gameRef.child(GameDataBranches.GAME_BRANCHES.METADATA);
      metaRef.update({
        [GameDataBranches.METADATA.PLAYERS] : [activeGames[gameId].players],
      });

      var gameDataRef = gameRef.child(GameDataBranches.GAME_BRANCHES.GAME_DATA);

      gameDataRef.update({
        [GameDataBranches.GAME_DATA.SCORES] : activeGames[gameId].scores,
        [GameDataBranches.GAME_DATA.GUESS_TRACKS] : activeGames[gameId].roundSongs
      });
      
      // Broadcast game completed
      io.to(gameId).emit('game_completed', {
        game: activeGames[gameId],
        finalScores: activeGames[gameId].scores
      });
    }
  });

  // Handle game restart
  socket.on('restart_game', (data) => {
    const { gameId } = data;
    
    if (!activeGames[gameId] || activeGames[gameId].host !== socket.id) return;
    
    // Reset game state
    activeGames[gameId].status = 'waiting';
    activeGames[gameId].currentRound = 0;
    activeGames[gameId].currentSong = null;
    activeGames[gameId].roundSongs = {};
    activeGames[gameId].votes = {};
    
    // Reset scores
    Object.keys(activeGames[gameId].scores).forEach(playerId => {
      activeGames[gameId].scores[playerId] = 0;
    });
    
    // Reset ready status for all players except host
    activeGames[gameId].players.forEach((player, index) => {
      if (player.id !== activeGames[gameId].host) {
        activeGames[gameId].players[index].ready = false;
      }
    });
    
    // Broadcast game restarted
    io.to(gameId).emit('game_restarted', { game: activeGames[gameId] });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    // Find games this player is in
    Object.keys(activeGames).forEach(gameId => {
      const game = activeGames[gameId];
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        // Remove player from the game
        const removedPlayer = game.players.splice(playerIndex, 1)[0];
        
        if (game.players.length === 0) {
          // Delete game if no players left
          delete activeGames[gameId];
          console.log(`Game deleted: ${gameId} (no players left)`);
        } else if (game.host === socket.id) {
          // Assign a new host if the host left
          game.host = game.players[0].id;
          
          // Notify remaining players about host change
          io.to(gameId).emit('host_changed', {
            newHost: game.players[0],
            game: game
          });
        }
        
        // Notify remaining players about player leaving
        io.to(gameId).emit('player_left', {
          player: removedPlayer,
          game: game
        });
      }
    });
  });
});

// Basic route for checking server status
app.get('/', (req, res) => {
  res.send('Synth WebSocket Server is running!');
});

// Get active games
app.get('/games', (req, res) => {
  const gamesList = Object.values(activeGames).map(game => ({
    id: game.id,
    name: game.name,
    playerCount: game.players.length,
    status: game.status
  }));
  
  res.json({ games: gamesList });
});

// Server port
const PORT = process.env.PORT || 3000;

// Start server only when run directly (not when imported as a module)
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server is ready for connections`);
  });
}

// Export the function and other necessary components
module.exports = {
  generateSimpleGameCode,
  app,
  server,
  io,
  activeGames
}; 