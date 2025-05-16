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

// Add a new data structure to track username to socket ID mappings within each game
const gameUsernameMappings = {};

// Also add an object to track scores by username
const gameUsernameScores = {};

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

// Add a new function to broadcast current scores to clients in a game
function broadcastGameScores(gameId) {
  const game = activeGames[gameId];
  if (!game) return;
  
  // Construct the scores object with both socket ID and username keys
  const scoresWithUsernames = {};
  
  // First use our persistent username-based scores (most reliable)
  if (gameUsernameScores[gameId]) {
    Object.entries(gameUsernameScores[gameId]).forEach(([username, points]) => {
      scoresWithUsernames[username] = points;
    });
  }
  
  // Then add any socket-based scores as fallback
  Object.entries(game.scores || {}).forEach(([playerId, points]) => {
    const username = getUsernameById(gameId, playerId);
    if (username) {
      // Only update if it doesn't exist (to prevent overwriting username-based scores)
      if (scoresWithUsernames[username] === undefined) {
        scoresWithUsernames[username] = points;
      }
      // Always include the socket ID version for backward compatibility
      scoresWithUsernames[playerId] = points;
    } else {
      // Just keep the original if no username is found
      scoresWithUsernames[playerId] = points;
    }
  });
  
  // Ensure all players have a score
  game.players.forEach(player => {
    if (player.username && scoresWithUsernames[player.username] === undefined) {
      scoresWithUsernames[player.username] = 0;
    }
    if (scoresWithUsernames[player.id] === undefined) {
      scoresWithUsernames[player.id] = 0;
    }
  });
  
  // Send a dedicated score update event
  io.to(gameId).emit('score_update', {
    gameId,
    scores: game.scores,
    scoresWithUsernames,
    playerMappings: gameUsernameMappings[gameId] || {}
  });
  
  console.log(`[PLAYER_MAPPING] Broadcast score update to game ${gameId}: ${JSON.stringify(scoresWithUsernames)}`);
}

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
    //TODO: change the id in this case to be the actual gameID and add a different
    //  field for the invite code. We can talk more about this when were together.
    const hostUsername = gameData.hostUsername || 'Host';
    const hostTracks = gameData.tracks || []; // Accept tracks in creation payload

    var gameRef = db.ref(DATABASE_BRANCHES.GAMES).child(GAME_TREE.GAMES);

    console.log("Game Name: " + gameName);

    var gamePush = gameRef.push({
      [GameDataBranches.METADATA.NAME] : gameName
    });

    var gameId = gamePush.key;

    console.log("Game ID: " + gameId);

    var inviteCodeRef = db.ref(DATABASE_BRANCHES.GAMES).child(GAME_TREE.INVITE_CODE).child(gameInviteCode);
    inviteCodeRef.set(gameId);
    
    
    // Initialize username mappings for this game
    gameUsernameMappings[gameId] = {};
    gameUsernameMappings[gameId][hostUsername] = socket.id;
    console.log(`[PLAYER_MAPPING] Created mapping for host "${hostUsername}" to socket ID ${socket.id} in game ${gameId}`);
    
    // Extract profile information if available
    const profileInfo = gameData.profileInfo || null;
    
    console.log(`Creating game ${gameId} with host ${hostUsername}, ${hostTracks.length} tracks provided by host`);
    
    // Create game room with the simple code (not prefixed with "game-")
    activeGames[gameId] = {
      id: gameInviteCode,
      name: gameName,
      host: socket.id,
      players: [{ 
        id: socket.id, 
        username: hostUsername, 
        ready: true,
        // Add profile information if available
        profilePicture: profileInfo?.profilePicture || null,
        displayName: profileInfo?.displayName || hostUsername,
        spotifyId: profileInfo?.spotifyId || null
      }],
      status: 'waiting',
      currentRound: 0,
      maxRounds: gameData.maxRounds || 3,
      currentSong: null,
      roundSongs: {},
      votes: {},
      scores: {},
      clientPlaying: {}, // Track what songs each client is playing
      currentRoundTraceId: null, // Track the current round's trace ID
      playerTracks: {} // Initialize player tracks object
    };
    
    // IMPORTANT: Store host tracks immediately if provided
    if (hostTracks.length > 0) {
      activeGames[gameId].playerTracks[socket.id] = hostTracks.slice(0, 5); // Limit to 5 tracks
      
      // Log a sample track
      if (hostTracks[0]) {
        console.log(`[TRACK_SYNC] Host ${hostUsername} provided track: "${hostTracks[0].title || hostTracks[0].songTitle}" by ${
          hostTracks[0].artists || hostTracks[0].songArtists || 'Unknown Artist'
        }`);
        console.log(`[TRACK_SYNC] Preview URL available: ${hostTracks[0].previewUrl ? 'YES' : 'NO'}`);
      }
    }
    
    socket.join(gameId);
    console.log(`Game created: ${gameId} by ${socket.id}`);
    
    // IMPORTANT: Store the host's tracks if provided with game creation
    if (gameData.hostTracks && Array.isArray(gameData.hostTracks) && gameData.hostTracks.length > 0) {
      console.log(`[TRACK_SYNC] Host ${hostUsername} (${socket.id}) provided ${gameData.hostTracks.length} tracks when creating game ${gameId}`);
      
      // Initialize playerTracks object
      if (!activeGames[gameId].playerTracks) {
        activeGames[gameId].playerTracks = {};
      }
      
      // Store the host's tracks, limited to 5 tracks
      activeGames[gameId].playerTracks[socket.id] = gameData.hostTracks.slice(0, 5);
      
      // Log a sample track for debugging
      if (gameData.hostTracks.length > 0) {
        console.log(`[TRACK_SYNC] Sample track from host: "${gameData.hostTracks[0].songTitle}" by ${gameData.hostTracks[0]?.songArtists?.join(', ') || 'Unknown'}`);
        console.log(`[TRACK_SYNC] Preview URL available: ${gameData.hostTracks[0].previewUrl ? 'YES' : 'NO'}`);
      }
      
      // Acknowledge tracks were received
      socket.emit('player_tracks_received', { 
        status: 'success',
        message: 'Your songs have been received'
      });
      
      // Run initial preparation to include host tracks
      prepareGameTracks(gameId);
    }
    
    // Emit game created event
    socket.emit('game_created', { gameId, game: activeGames[gameId] });
  });

  // Handle joining a game
  socket.on('join_game', async (data) => {
    const { gameId, username, profilePicture, playerTracks } = data;


    //The gameID is the invite code, so we need to translate it to the actual gameID
    //This will look up the gameID from the invite code branch in firebase and return it
    var translateRef = db.ref(DATABASE_BRANCHES.GAMES).child(GAME_TREE.INVITE_CODE).child(gameId);
    const actualGameId = await translateRef.once('value');
    
    if (!activeGames[actualGameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    // Check if game is full
    if (activeGames[actualGameId].players.length >= 7) {
      socket.emit('error', { message: 'Game is full' });
      return;
    }
    
    console.log(`[TRACK_SYNC] Player ${username} (${socket.id}) joining game ${gameId} with ${playerTracks?.length || 0} tracks`);
    
    // Initialize username mappings for this game if it doesn't exist
    if (!gameUsernameMappings[gameId]) {
      gameUsernameMappings[gameId] = {};
    }
    
    // Store/update the socket ID mapping for this username
    const previousSocketId = gameUsernameMappings[gameId][username];
    gameUsernameMappings[gameId][username] = socket.id;
    console.log(`[PLAYER_MAPPING] Mapped username "${username}" to socket ID ${socket.id} in game ${gameId}`);
    
    if (previousSocketId && previousSocketId !== socket.id) {
      console.log(`[PLAYER_MAPPING] Updated socket ID mapping for ${username} from ${previousSocketId} to ${socket.id}`);
    }
    
    // Extract profile information if available
    const profilePic = profileInfo?.profilePicture || profilePicture || null;
    const displayName = profileInfo?.displayName || username;
    const spotifyId = profileInfo?.spotifyId || null;
    
    if (profileInfo) {
      console.log(`Player ${username} has Spotify profile: ${displayName}, Profile picture: ${profilePic ? 'Yes' : 'No'}`);
    }
    
    // Log a sample of player's tracks for debugging
    if (playerTracks && playerTracks.length > 0) {
      console.log(`[TRACK_SYNC] Sample track from ${username}: "${playerTracks[0].songTitle}" by ${playerTracks[0]?.songArtists?.join(', ') || 'Unknown'}`);
      console.log(`[TRACK_SYNC] Preview URL available: ${playerTracks[0].previewUrl ? 'YES' : 'NO'}`);
      
      // IMPORTANT: Verify that at least some tracks have preview URLs
      const tracksWithPreviews = playerTracks.filter(track => !!track.previewUrl);
      console.log(`[TRACK_SYNC] ${username} provided ${tracksWithPreviews.length}/${playerTracks.length} tracks with preview URLs`);
      
      if (tracksWithPreviews.length === 0) {
        console.warn(`[TRACK_SYNC] WARNING: ${username} provided NO tracks with previewUrls!`);
      }
    }
    
    // Check if a player with this username already exists in the game
    const existingPlayerIndex = activeGames[actualGameId].players.findIndex(p => p.username === username);
    
    if (existingPlayerIndex !== -1) {
      // Player with this username already exists
      // Update their socket ID instead of adding a duplicate
      const oldSocketId = activeGames[actualGameId].players[existingPlayerIndex].id;
      
      // Update the player's socket ID and profile information
      activeGames[gameId].players[existingPlayerIndex].id = socket.id;
      activeGames[gameId].players[existingPlayerIndex].profilePicture = profilePic;
      activeGames[gameId].players[existingPlayerIndex].displayName = displayName;
      activeGames[gameId].players[existingPlayerIndex].spotifyId = spotifyId;
      
      // Store the player's tracks if provided
      if (playerTracks && Array.isArray(playerTracks) && playerTracks.length > 0) {
        // Initialize playerTracks object if it doesn't exist
        if (!activeGames[gameId].playerTracks) {
          activeGames[gameId].playerTracks = {};
        }
        
        // Store the player's tracks, limited to 5 tracks
        activeGames[gameId].playerTracks[socket.id] = playerTracks.slice(0, 5);
        
        // Acknowledge tracks were received
        socket.emit('player_tracks_received', { 
          status: 'success',
          message: 'Your songs have been received'
        });
      }
      
      // Update the player's score entry
      if (activeGames[gameId].scores[oldSocketId] !== undefined) {
        // Transfer the old socket ID score to the new socket ID
        activeGames[gameId].scores[socket.id] = activeGames[gameId].scores[oldSocketId];
        console.log(`[PLAYER_MAPPING] Transferred score of ${activeGames[gameId].scores[oldSocketId]} from old socket ${oldSocketId} to new socket ${socket.id}`);
        delete activeGames[gameId].scores[oldSocketId];
      } else {
        // If we don't have a score for the old socket ID, check our username scores
        if (gameUsernameScores[gameId] && gameUsernameScores[gameId][username] !== undefined) {
          // Use the score from our username-based tracking
          activeGames[gameId].scores[socket.id] = gameUsernameScores[gameId][username];
          console.log(`[PLAYER_MAPPING] Set score for ${socket.id} to ${gameUsernameScores[gameId][username]} based on username tracking`);
        } else {
          // No score found in either place, initialize to 0
          activeGames[gameId].scores[socket.id] = 0;
        }
      }
      
      // If this player was the host, update the host reference
      if (activeGames[actualGameId].host === oldSocketId) {
        activeGames[actualGameId].host = socket.id;
      }
      
      socket.join(actualGameId);
      console.log(`Player reconnected: ${username} to game ${actualGameId} (replaced socket ID ${oldSocketId} with ${socket.id})`);
      
      // Notify everyone in the room about the updated game state
      io.to(gameId).emit('player_joined', {
        game: activeGames[gameId],
        newPlayer: { 
          id: socket.id, 
          username,
          profilePicture: profilePic,
          displayName,
          spotifyId
        },
        // Include username mappings for client reference
        playerMappings: gameUsernameMappings[gameId] || {}
      });
    } else {
      // Add new player to game
      activeGames[actualGameId].players.push({
        id: socket.id,
        username,
        profilePicture: profilePic,
        displayName,
        spotifyId,
        ready: false
      });

      // Store the player's tracks if provided
      if (playerTracks && Array.isArray(playerTracks) && playerTracks.length > 0) {
        // Initialize playerTracks object if it doesn't exist
        if (!activeGames[gameId].playerTracks) {
          activeGames[gameId].playerTracks = {};
        }
        
        // Store the player's tracks, limited to 5 tracks
        activeGames[gameId].playerTracks[socket.id] = playerTracks.slice(0, 5);
        
        // Acknowledge tracks were received
        socket.emit('player_tracks_received', { 
          status: 'success',
          message: 'Your songs have been received'
        });
        
        // IMPORTANT: Prepare game tracks immediately when we get player tracks
        // This ensures the song pool is ready before the game starts
        prepareGameTracks(gameId);
      }
      
      socket.join(gameId);
      console.log(`Player joined: ${username} to game ${gameId}`);
      
      // Initialize score for new player
      activeGames[actualGameId].scores[socket.id] = 0;
      
      // Notify everyone in the room about the new player
      io.to(gameId).emit('player_joined', {
        game: activeGames[gameId],
        newPlayer: { 
          id: socket.id, 
          username,
          profilePicture: profilePic,
          displayName,
          spotifyId
        },
        // Include username mappings for client reference
        playerMappings: gameUsernameMappings[gameId] || {}
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
        
        // IMPORTANT: Start round 1 automatically when all players are ready
        if (activeGames[gameId].host === socket.id) {
          // Ensure we have a valid consolidated playlist
          if (activeGames[gameId].consolidatedPlaylist && 
              activeGames[gameId].consolidatedPlaylist.length > 0) {
            console.log(`[TRACK_SYNC] Auto-starting round 1 for game ${gameId}`);
            
            // Set up game for round 1
            activeGames[gameId].currentRound = 1;
            
            // Create trace ID for round 1
            const round1TraceId = `ROUND_${gameId}_1_${Date.now()}`;
            activeGames[gameId].currentRoundTraceId = round1TraceId;
            
            // Get the first song from the playlist
            const firstSong = activeGames[gameId].consolidatedPlaylist[0].track;
            const firstSongOwner = activeGames[gameId].consolidatedPlaylist[0].owner;
            
            // Create the song with trace ID
            const songWithTraceId = {
              ...firstSong,
              roundTraceId: round1TraceId
            };
            
            // Store the song in round data
            if (!activeGames[gameId].roundSongs) {
              activeGames[gameId].roundSongs = {};
            }
            
            activeGames[gameId].roundSongs[1] = {
              song: songWithTraceId,
              owner: firstSongOwner,
              roundTraceId: round1TraceId
            };
            
            // Send round started event to all clients
            io.to(gameId).emit('round_started', {
              gameId,
              roundNumber: 1,
              song: songWithTraceId,
              roundTraceId: round1TraceId,
              // Add username mappings to ensure clients can match socket IDs to usernames
              playerMappings: gameUsernameMappings[gameId] || {}
            });
            
            console.log(`[TRACK_SYNC] Round 1 auto-started for game ${gameId}`);
          } else {
            console.error(`[TRACK_SYNC] Cannot auto-start round 1: No consolidated playlist available`);
          }
        }
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
    // ALWAYS start at round 1, never 0
    activeGames[gameId].currentRound = 1;
    
    // Initialize clientPlaying object if it doesn't exist
    if (!activeGames[gameId].clientPlaying) {
      activeGames[gameId].clientPlaying = {};
    }
    
    console.log(`[TRACK_SYNC] Game ${gameId} started with round ${activeGames[gameId].currentRound}`);
    
    // Prepare the track assignments for the game
    prepareGameTracks(gameId);
    
    // Broadcast game start to all players
    io.to(gameId).emit('game_started', { game: activeGames[gameId] });
    
    // NEW: Send the consolidated playlist to all players
    io.to(gameId).emit('playlist_shared', { 
      gameId,
      playlist: activeGames[gameId].consolidatedPlaylist.map(item => ({
        track: {
          songTitle: item.track.songTitle,
          songArtists: Array.isArray(item.track.songArtists) ? 
            item.track.songArtists : 
            [item.track.songArtists],
          albumName: item.track.albumName,
          imageUrl: item.track.imageUrl,
          previewUrl: item.track.previewUrl,
          uri: item.track.uri,
          trackId: item.track.trackId,
          duration: item.track.duration
        },
        owner: {
          id: item.owner.id,
          username: item.owner.username
        }
      }))
    });
    
    // IMPORTANT: Start round 1 automatically
    if (activeGames[gameId].consolidatedPlaylist && 
        activeGames[gameId].consolidatedPlaylist.length > 0) {
      console.log(`[TRACK_SYNC] Auto-starting round 1 for game ${gameId}`);
      
      // Set up game for round 1
      activeGames[gameId].currentRound = 1;
      
      // Create trace ID for round 1
      const round1TraceId = `ROUND_${gameId}_1_${Date.now()}`;
      activeGames[gameId].currentRoundTraceId = round1TraceId;
      
      // Get the first song from the playlist
      const firstSong = activeGames[gameId].consolidatedPlaylist[0].track;
      const firstSongOwner = activeGames[gameId].consolidatedPlaylist[0].owner;
      
      // Create the song with trace ID
      const songWithTraceId = {
        ...firstSong,
        roundTraceId: round1TraceId
      };
      
      // Store the song in round data
      if (!activeGames[gameId].roundSongs) {
        activeGames[gameId].roundSongs = {};
      }
      
      activeGames[gameId].roundSongs[1] = {
        song: songWithTraceId,
        owner: firstSongOwner,
        roundTraceId: round1TraceId
      };
      
      // Send round started event to all clients
      io.to(gameId).emit('round_started', {
        gameId,
        roundNumber: 1,
        song: songWithTraceId,
        roundTraceId: round1TraceId,
        // Add username mappings to ensure clients can match socket IDs to usernames
        playerMappings: gameUsernameMappings[gameId] || {}
      });
      
      console.log(`[TRACK_SYNC] Round 1 auto-started for game ${gameId}`);
    }
  });

  // Handle client sharing tracks
  socket.on('share_tracks', (data) => {
    const { gameId, tracks } = data;
    const game = activeGames[gameId];

    if (!game) {
      console.error(`[TRACK_SYNC] Game ${gameId} not found for share_tracks request`);
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    if (!game.playerTracks) {
      game.playerTracks = {};
    }

    // Validate and normalize tracks
    const validTracks = Array.isArray(tracks) ? tracks.filter(track => 
      track && 
      track.songTitle && 
      (track.songArtists || track.artists) // Accept either format for backward compatibility
    ) : [];

    // Find the player in the game
    const player = game.players.find(p => p.id === socket.id);
    if (!player) {
      console.error(`[TRACK_SYNC] Player with socket ${socket.id} not found in game ${gameId}`);
      socket.emit('error', { message: 'Player not found in game' });
      return;
    }

    console.log(`[TRACK_SYNC] Player ${player.username} (${socket.id}) sharing ${validTracks.length} tracks for game ${gameId}`);

    if (validTracks.length > 0) {
      // Create a sample track for logging
      const sampleTrack = validTracks[0];
      console.log(`[TRACK_SYNC] Sample track from ${player.username}: "${sampleTrack.songTitle}" by ${Array.isArray(sampleTrack.songArtists) ? sampleTrack.songArtists.join(', ') : (sampleTrack.artists || 'Unknown')}`);
      
      // Check if preview URLs are available for logging purposes
      const hasPreviewUrl = sampleTrack.previewUrl && typeof sampleTrack.previewUrl === 'string';
      console.log(`[TRACK_SYNC] Preview URL available: ${hasPreviewUrl ? 'YES' : 'NO'}`);
      if (hasPreviewUrl) {
        console.log(`[TRACK_SYNC] Preview URL source: ${sampleTrack.previewUrl.includes('deezer') ? 'Deezer' : 'Spotify'}`);
      }
      
      // Count tracks with preview URLs
      const tracksWithPreviewUrls = validTracks.filter(track => track.previewUrl && typeof track.previewUrl === 'string');
      console.log(`[TRACK_SYNC] ${player.username} provided ${tracksWithPreviewUrls.length}/${validTracks.length} tracks with preview URLs`);
      
      if (tracksWithPreviewUrls.length === 0) {
        console.log(`[TRACK_SYNC] WARNING: ${player.username} provided NO tracks with previewUrls!`);
      }
      
      // Store tracks with the player ID
      game.playerTracks[player.id] = validTracks;
      
      // Check if all players have shared tracks
      const playersWithTracks = Object.keys(game.playerTracks).length;
      const totalPlayers = game.players.length;
      
      console.log(`[TRACK_SYNC] ${playersWithTracks}/${totalPlayers} players have shared tracks`);
      
      // If all players have shared tracks, we can prepare the game
      if (playersWithTracks === totalPlayers) {
        prepareGameTracks(gameId);
      }
    } else {
      console.log(`[TRACK_SYNC] WARNING: Player ${player.username} shared no valid tracks`);
      socket.emit('error', { message: 'No valid tracks provided' });
    }
  });

  function prepareGameTracks(gameId) {
    const game = activeGames[gameId];
    
    if (!game) {
      console.error(`[TRACK_SYNC] ERROR: Game ${gameId} not found when preparing tracks`);
      return;
    }
    
    console.log(`[TRACK_SYNC] PREPARING TRACKS for game ${gameId}`);
    
    // Create a map to store which tracks belong to which players
    game.trackAssignments = {};
    game.roundSongs = {};
    
    // Initialize consolidated playlist
    game.consolidatedPlaylist = [];
    
    // Check if we have player tracks
    if (!game.playerTracks || Object.keys(game.playerTracks).length === 0) {
      console.warn(`[TRACK_SYNC] WARNING: Game ${gameId} has no player tracks, using fallback tracks only`);
      addMockTracksToGame(game);
      sharePlaylistWithClients(gameId);
      return;
    }
    
    // Count how many players and how many host tracks there are
    const playerIds = Object.keys(game.playerTracks);
    let hostTracksCount = 0;
    
    // Check if host has provided tracks
    if (game.host && game.playerTracks[game.host]) {
      hostTracksCount = game.playerTracks[game.host].length;
      console.log(`[TRACK_SYNC] Host has provided ${hostTracksCount} tracks`);
    } else {
      console.warn(`[TRACK_SYNC] Host ${game.host} has NOT provided any tracks`);
    }
    
    console.log(`[TRACK_SYNC] Processing tracks from ${playerIds.length} players`);
    
    // Process each player's tracks 
    let validTracksCount = 0;
    let tracksWithPreviewUrls = 0;
    let tracksFromHostPlayer = 0;
    
    Object.entries(game.playerTracks).forEach(([playerId, playerTracks]) => {
      // Find the player object
      const player = game.players.find(p => p.id == playerId);
      if (!player) {
        console.warn(`[TRACK_SYNC] WARNING: Player ID ${playerId} not found in game players`);
        return;
      }
      
      // Check if this is the host
      const isHost = playerId === game.host;
      const playerLabel = isHost ? `host player ${player.username}` : `player ${player.username}`;
      
      console.log(`[TRACK_SYNC] Processing ${playerTracks.length} tracks from ${playerLabel}`);
      
      // Process each track
      playerTracks.forEach(track => {
        // Check for required fields and preview URL
        if (!track.songTitle) {
          console.log(`[TRACK_SYNC] Track missing title, skipping`);
          return;
        }
        
        // Check for preview URL
        const hasPreviewUrl = track.previewUrl && typeof track.previewUrl === 'string';
        console.log(`[TRACK_SYNC] Track "${track.songTitle}" has ${hasPreviewUrl ? 'VALID' : 'NO'} preview URL, but keeping it anyway`);
        
        // Normalize track format
        const normalizedTrack = {
          songTitle: track.songTitle,
          songArtists: track.songArtists || (Array.isArray(track.artists) ? track.artists : [track.artists || 'Unknown']),
          albumName: track.albumName || track.album || 'Unknown Album',
          imageUrl: track.imageUrl || track.image || null,
          previewUrl: track.previewUrl || null,
          duration: track.duration || 30000,
          externalUrl: track.externalUrl || null,
          uri: track.uri || null,
          isRealTrack: true  // Flag to distinguish from mock tracks
        };
        
        // Add to consolidated playlist with player info
        game.consolidatedPlaylist.push({
          track: normalizedTrack,
          owner: {
            id: player.id,
            username: player.username
          }
        });
        
        validTracksCount++;
        
        if (hasPreviewUrl) {
          tracksWithPreviewUrls++;
        }
        
        if (isHost) {
          tracksFromHostPlayer++;
        }
      });
    });
    
    console.log(`[TRACK_SYNC] Collected ${validTracksCount} valid tracks total`);
    console.log(`[TRACK_SYNC] ${tracksWithPreviewUrls} tracks have preview URLs`);
    console.log(`[TRACK_SYNC] ${tracksFromHostPlayer} tracks from host player (should be roughly equal to other players)`);

    // Shuffle the tracks to ensure variety between rounds
    game.consolidatedPlaylist = shuffleArray([...game.consolidatedPlaylist]);
    console.log(`[TRACK_SYNC] Shuffling ${game.consolidatedPlaylist.length} tracks for rounds`);
    
    // Check if we need to add mock tracks
    if (tracksWithPreviewUrls === 0) {
      console.log(`[TRACK_SYNC] No tracks have preview URLs, using fallback tracks`);
      addMockTracksToGame(game);
    } else if (game.consolidatedPlaylist.length < game.players.length * 2) {
      // If we don't have enough tracks for each player to have at least 2
      console.log(`[TRACK_SYNC] Not enough tracks (${game.consolidatedPlaylist.length}) for ${game.players.length} players, adding some mock tracks`);
      
      // Add just enough mock tracks to supplement
      const tracksToAdd = (game.players.length * 2) - game.consolidatedPlaylist.length;
      addMockTracksToGame(game, tracksToAdd);
    }
    
    // Finalize the number of rounds based on available tracks
    const availableTracks = game.consolidatedPlaylist.length;
    const recommendedRounds = Math.min(availableTracks, 10); // Cap at 10 rounds
    
    // Ensure at least 3 rounds if possible
    if (availableTracks >= 3) {
      game.maxRounds = recommendedRounds;
    } else {
      game.maxRounds = availableTracks;
    }
    
    console.log(`[TRACK_SYNC] Set max rounds to ${game.maxRounds} based on available tracks`);
    
    // Log the final playlist for debugging
    console.log(`[TRACK_SYNC] Final playlist for game ${gameId} (${game.consolidatedPlaylist.length} tracks):`);
    game.consolidatedPlaylist.forEach((item, index) => {
      const trackType = item.track.isMockTrack ? '[MOCK]' : '[USER]';
      const ownerInfo = item.owner.id === game.host ? `${item.owner.username} (HOST)` : item.owner.username;
      console.log(`[TRACK_SYNC]   ${index+1}. ${trackType} "${item.track.songTitle}" by ${
        Array.isArray(item.track.songArtists) ? 
          item.track.songArtists.join(', ') : 
          item.track.songArtists
      } (from ${ownerInfo})`);
      console.log(`[TRACK_SYNC]       Preview URL: ${item.track.previewUrl ? item.track.previewUrl.substring(0, 30) + '...' : 'Missing'}`);
    });
    
    // Share the consolidated playlist with clients
    sharePlaylistWithClients(gameId);
  }

  function addMockTracksToGame(game, tracksToAdd = null) {
    const mockTracks = [
      {
        songTitle: "Bohemian Rhapsody",
        songArtists: ["Queen"],
        albumName: "A Night at the Opera",
        imageUrl: "https://i.scdn.co/image/ab67616d0000b2739f39192f4f0fae773d3f8a95",
        previewUrl: "https://p.scdn.co/mp3-preview/1f3bd078c7ad27b427fa210f6efd957fc5eecea0",
        duration: 354000,
        isMockTrack: true
      },
      {
        songTitle: "Don't Stop Believin'",
        songArtists: ["Journey"],
        albumName: "Escape",
        imageUrl: "https://i.scdn.co/image/ab67616d0000b273c5653f9038e42efad2f8def2",
        previewUrl: "https://p.scdn.co/mp3-preview/21b9abd3cd2eea634e17a917196fdd5ba2e82670",
        duration: 251000,
        isMockTrack: true
      },
      {
        songTitle: "Billie Jean",
        songArtists: ["Michael Jackson"],
        albumName: "Thriller",
        imageUrl: "https://i.scdn.co/image/ab67616d0000b2734121faee8df82c526cbab2be",
        previewUrl: "https://p.scdn.co/mp3-preview/f504e6b8e037771318656394f532dede4f9bcaea",
        duration: 294000,
        isMockTrack: true
      },
      {
        songTitle: "Sweet Child O' Mine",
        songArtists: ["Guns N' Roses"],
        albumName: "Appetite for Destruction",
        imageUrl: "https://i.scdn.co/image/ab67616d0000b273e44963b8bb127552ac0090e0",
        previewUrl: "https://p.scdn.co/mp3-preview/9af2ebe7ff34dbdbcb042fba67b81bcdd6f9dbe3",
        duration: 356000,
        isMockTrack: true
      },
      {
        songTitle: "I Want It That Way",
        songArtists: ["Backstreet Boys"],
        albumName: "Millennium",
        imageUrl: "https://i.scdn.co/image/ab67616d0000b27384c52f39de3a4e687424f622",
        previewUrl: "https://p.scdn.co/mp3-preview/c9a980c0a1e48b84795c2c28ab212a476d5dae43",
        duration: 213000,
        isMockTrack: true
      }
    ];

    // If we already have real tracks, check how many mock tracks to add
    if (tracksToAdd) {
      console.log(`[TRACK_SYNC] Adding ${tracksToAdd} mock tracks to supplement real tracks`);
      
      const availableMockTracks = [...mockTracks].slice(0, tracksToAdd);
      const players = game.players.slice(); // Create a copy so we can shuffle
      shuffleArray(players);
      
      // Assign mock tracks to players
      for (let i = 0; i < availableMockTracks.length; i++) {
        const playerIndex = i % players.length;
        const player = players[playerIndex];
        
        game.consolidatedPlaylist.push({
          track: availableMockTracks[i],
          owner: {
            id: player.id,
            username: player.username
          }
        });
        
        console.log(`[TRACK_SYNC] Added mock track "${availableMockTracks[i].songTitle}" assigned to ${player.username}`);
      }
    } else {
      // If we need only mock tracks, create a full playlist
      const playerCount = game.players.length;
      const tracksPerPlayer = Math.max(Math.ceil(3 / playerCount), 1); // At least 3 rounds total
      const totalMockTracksNeeded = Math.min(playerCount * tracksPerPlayer, mockTracks.length);
      
      console.log(`[TRACK_SYNC] Creating mock playlist with ${totalMockTracksNeeded} tracks for ${playerCount} players`);
      
      // Create a copy of players array so we can shuffle
      const players = game.players.slice();
      
      // Use Fisher-Yates shuffle
      shuffleArray(players);
      
      // Assign tracks to players for balanced gameplay
      game.consolidatedPlaylist = [];
      
      for (let i = 0; i < totalMockTracksNeeded; i++) {
        const playerIndex = i % players.length;
        const player = players[playerIndex];
        
        if (i < mockTracks.length) {
          game.consolidatedPlaylist.push({
            track: mockTracks[i],
            owner: {
              id: player.id,
              username: player.username
            }
          });
          
          console.log(`[TRACK_SYNC] Added mock track "${mockTracks[i].songTitle}" assigned to ${player.username}`);
        }
      }
      
      game.maxRounds = Math.min(totalMockTracksNeeded, 5); // Limit mock games to 5 rounds
      console.log(`[TRACK_SYNC] Set max rounds to ${game.maxRounds} based on available mock tracks`);
    }
    
    return game.consolidatedPlaylist;
  }
  
  function sharePlaylistWithClients(gameId) {
    const game = activeGames[gameId];
    
    if (!game) {
      console.error(`[TRACK_SYNC] Game ${gameId} not found when sharing playlist`);
      return;
    }
    
    if (!game.consolidatedPlaylist || !Array.isArray(game.consolidatedPlaylist)) {
      console.error(`[TRACK_SYNC] Game ${gameId} has no playlist to share`);
      return;
    }
    
    // Share the playlist with all clients
    console.log(`[TRACK_SYNC] Sharing playlist with ${game.players.length} players in game ${gameId}`);
    
    // Count real tracks vs mock tracks
    const realTracks = game.consolidatedPlaylist.filter(item => !item.track.isMockTrack);
    const mockTracks = game.consolidatedPlaylist.filter(item => item.track.isMockTrack);
    
    console.log(`[TRACK_SYNC] Playlist contains ${realTracks.length} real tracks and ${mockTracks.length} mock tracks`);
    
    // Notify all clients
    io.to(gameId).emit('playlist_shared', {
      gameId,
      playlist: game.consolidatedPlaylist,
      maxRounds: game.maxRounds
    });
    
    console.log(`[TRACK_SYNC] Playlist shared, game ready for play with ${game.maxRounds} rounds`);
    
    // If this is a fresh game, start round 1
    if (!game.currentRound || game.currentRound < 1) {
      selectRandomSongForRound(gameId, 1);
    }
  }

  // Helper function to shuffle an array (Fisher-Yates algorithm)
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Selects a random song for a specific round and notifies clients
  function selectRandomSongForRound(gameId, roundNumber) {
    console.log(`[TRACK_SYNC] Selecting song for game ${gameId} round ${roundNumber}`);
    const game = activeGames[gameId];
    
    if (!game) {
      console.error(`[TRACK_SYNC] Game ${gameId} not found for song selection`);
      return;
    }
    
    if (!game.consolidatedPlaylist || !Array.isArray(game.consolidatedPlaylist) || game.consolidatedPlaylist.length === 0) {
      console.error(`[TRACK_SYNC] Game ${gameId} has no playlist for song selection`);
      return;
    }
    
    // Set the current round in the game state
    game.currentRound = roundNumber;
    
    // 1. First, check if we already have a song for this round
    if (game.roundSongs && game.roundSongs[roundNumber]) {
      console.log(`[TRACK_SYNC] Using existing song selection for round ${roundNumber}`);
      startRoundWithSong(gameId, roundNumber, game.roundSongs[roundNumber]);
      return;
    }
    
    // 2. Try to select a new song by prioritizing real tracks over mock tracks
    
    // Get all available tracks that haven't been used in previous rounds
    const usedTrackIds = Object.values(game.roundSongs || {}).map(song => song.trackId || song.title);
    
    // Filter available tracks: first real tracks, then fallback to mock if needed
    let availableTracks = game.consolidatedPlaylist.filter(item => 
      !usedTrackIds.includes(item.track.trackId) && 
      !usedTrackIds.includes(item.track.songTitle) &&
      !item.track.isMockTrack && // Prefer real tracks first
      item.track.previewUrl // Must have a preview URL
    );
    
    // If we don't have enough real tracks, include mock tracks too
    if (availableTracks.length === 0) {
      console.log(`[TRACK_SYNC] No unused real tracks with preview URLs available, including mock tracks`);
      availableTracks = game.consolidatedPlaylist.filter(item => 
        !usedTrackIds.includes(item.track.trackId) && 
        !usedTrackIds.includes(item.track.songTitle) &&
        item.track.previewUrl // Must have a preview URL
      );
    }
    
    // If we still don't have enough tracks, use any available track with preview URL
    if (availableTracks.length === 0) {
      console.log(`[TRACK_SYNC] No unused tracks available, reusing tracks with preview URLs`);
      availableTracks = game.consolidatedPlaylist.filter(item => item.track.previewUrl);
    }
    
    // If we still don't have tracks, this is a critical error
    if (availableTracks.length === 0) {
      console.error(`[TRACK_SYNC] CRITICAL: No tracks with preview URLs available for game ${gameId}`);
      
      // Create an emergency track
      const emergencyTrack = {
        title: "Emergency Fallback Track",
        artists: "System",
        albumName: "Emergency",
        hasPreviewUrl: false,
        previewUrl: null,
        imageUrl: "https://via.placeholder.com/300",
        assignedPlayer: game.players[0]?.username || "Unknown"
      };
      
      startRoundWithSong(gameId, roundNumber, emergencyTrack);
      return;
    }
    
    // Select a random track from available tracks
    const randomIndex = Math.floor(Math.random() * availableTracks.length);
    const selectedTrack = availableTracks[randomIndex];
    
    console.log(`[TRACK_SYNC] Selected song for round ${roundNumber}: "${selectedTrack.track.songTitle}" (Trace ID: ROUND_${gameId}_${roundNumber}_${Date.now()})`);
    console.log(`[TRACK_SYNC] Song owner: ${selectedTrack.owner.username}`);
    console.log(`[TRACK_SYNC] PreviewUrl available: ${selectedTrack.track.previewUrl ? 'true' : 'false'}`);
    
    if (selectedTrack.track.isMockTrack) {
      console.log(`[TRACK_SYNC] USING MOCK TRACK for round ${roundNumber}`);
    }
    
    // Create the round song object
    const roundSong = {
      title: selectedTrack.track.songTitle,
      artists: Array.isArray(selectedTrack.track.songArtists) ? 
        selectedTrack.track.songArtists.join(', ') : 
        selectedTrack.track.songArtists,
      albumName: selectedTrack.track.albumName,
      hasPreviewUrl: !!selectedTrack.track.previewUrl,
      previewUrl: selectedTrack.track.previewUrl,
      imageUrl: selectedTrack.track.imageUrl,
      assignedPlayer: selectedTrack.owner.username,
      trackId: selectedTrack.track.trackId || selectedTrack.track.songTitle,
      roundTraceId: `ROUND_${gameId}_${roundNumber}_${Date.now()}`
    };
    
    // Save this track as the round song
    if (!game.roundSongs) {
      game.roundSongs = {};
    }
    game.roundSongs[roundNumber] = roundSong;
    
    // Start the round with this song
    startRoundWithSong(gameId, roundNumber, roundSong);
  }

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
  // Handle player vote

  socket.on('cast_vote', (data) => {
    const { gameId, votedForPlayerId, votedForUsername } = data;
    
    if (!activeGames[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    const game = activeGames[gameId];
    const currentRound = game.currentRound;
    
    // Record who this player voted for with better player ID handling
    if (!game.votes) {
      game.votes = {};
    }
    
    // Get the voted for player ID either directly or by username lookup
    let targetPlayerId = votedForPlayerId;
    
    // If we only have username, look up the corresponding player ID using our mapping
    if (!targetPlayerId && votedForUsername) {
      // First check our username mapping (most reliable)
      if (gameUsernameMappings[gameId] && gameUsernameMappings[gameId][votedForUsername]) {
        targetPlayerId = gameUsernameMappings[gameId][votedForUsername];
        console.log(`[PLAYER_MAPPING] Resolved username ${votedForUsername} to socket ID ${targetPlayerId} using direct mapping`);
      } else {
        // Fall back to searching players list
        const targetPlayer = game.players.find(p => p.username === votedForUsername);
        if (targetPlayer) {
          targetPlayerId = targetPlayer.id;
          console.log(`Resolved username ${votedForUsername} to player ID ${targetPlayerId}`);
        } else {
          console.log(`Could not find player with username ${votedForUsername}`);
        }
      }
    }

    // Make sure we have a valid player ID format to vote for
    game.votes[socket.id] = targetPlayerId;
    
    // Log which username is voting for which username (for clearer logs)
    const voterUsername = game.players.find(p => p.id === socket.id)?.username || 'Unknown';
    const votedForUsernameResolved = votedForUsername || 
      game.players.find(p => p.id === targetPlayerId)?.username || 'Unknown';
    
    console.log(`[PLAYER_MAPPING] Player "${voterUsername}" (${socket.id}) voted for "${votedForUsernameResolved}" (${targetPlayerId}) in round ${currentRound}`);
    
    // Try to get the correct player for this round with improved lookup
    let correctPlayerId = null;
    let correctPlayerUsername = null;
    
    // First check roundSongs data
    const roundData = game.roundSongs[currentRound];
    if (roundData && roundData.song && roundData.song.assignedToPlayer) {
      correctPlayerId = roundData.song.assignedToPlayer.id;
      correctPlayerUsername = roundData.song.assignedToPlayer.username;
      console.log(`Found assigned player in roundSongs: ${correctPlayerUsername} (${correctPlayerId})`);
    }
    // Then check consolidated playlist
    else if (game.consolidatedPlaylist && game.consolidatedPlaylist.length > 0) {
      // Use current round to index into playlist (with wraparound)
      const playlistIndex = (currentRound - 1) % game.consolidatedPlaylist.length;
      const playlistItem = game.consolidatedPlaylist[playlistIndex];
      
      if (playlistItem && playlistItem.owner) {
        correctPlayerId = playlistItem.owner.id;
        correctPlayerUsername = playlistItem.owner.username;
        console.log(`Found owner from consolidated playlist: ${correctPlayerUsername} (${correctPlayerId})`);
      }
    }
    
    // If we still don't have a correct player, use fallback
    if (!correctPlayerId && game.players.length > 0) {
      // Use host as fallback owner
      const fallbackPlayer = game.players.find(p => p.id === game.host) || game.players[0];
      correctPlayerId = fallbackPlayer.id;
      correctPlayerUsername = fallbackPlayer.username;
      console.log(`WARNING: Using fallback player assignment: ${correctPlayerUsername}`);
    }
    
    // Count votes received
    const totalPlayers = game.players.length;
    const totalVotes = Object.keys(game.votes).length;
    
    // Broadcast vote update
    io.to(gameId).emit('player_voted', {
      gameId,
      totalVotes,
      totalPlayers,
      round: currentRound,
      player: {
        id: socket.id,
        username: game.players.find(p => p.id === socket.id)?.username || 'Unknown'
      }
    });
    
    // If all votes are in, calculate points and broadcast results
    if (totalVotes >= totalPlayers) {
      console.log(`All votes received for round ${currentRound} in game ${gameId}`);
      
      // Initialize scores if needed
      if (!game.scores) {
        game.scores = {};
        game.players.forEach(player => {
          game.scores[player.id] = 0;
        });
      }
      
      // Award points for correct guesses ONLY (as requested by user)
      Object.entries(game.votes).forEach(([voterId, votedForId]) => {
        // Award points for correct guesses
        if (String(votedForId) === String(correctPlayerId) && voterId !== correctPlayerId) {
          game.scores[voterId] = (game.scores[voterId] || 0) + 1;
          
          // Add more detailed logging using username mappings
          const voterUsername = getUsernameById(gameId, voterId) || 'Unknown';
          const correctUsername = getUsernameById(gameId, correctPlayerId) || 'Unknown';
          console.log(`[PLAYER_MAPPING] Player "${voterUsername}" earned 1 point for correctly guessing "${correctUsername}"`);
          
          // Also track scores by username in our persistent store
          if (!gameUsernameScores[gameId]) {
            gameUsernameScores[gameId] = {};
          }
          
          // Update username-based score
          gameUsernameScores[gameId][voterUsername] = (gameUsernameScores[gameId][voterUsername] || 0) + 1;
          console.log(`[PLAYER_MAPPING] Updated username score: ${voterUsername} now has ${gameUsernameScores[gameId][voterUsername]} points`);
        }
      });
      
      // Add username mappings to the scores for more consistent display on client side
      const scoresWithUsernames = {};
      
      // First, add all scores from our username-based tracking (most reliable)
      if (gameUsernameScores[gameId]) {
        Object.entries(gameUsernameScores[gameId]).forEach(([username, points]) => {
          scoresWithUsernames[username] = points;
          console.log(`[PLAYER_MAPPING] Using tracked username score: ${username} = ${points}`);
        });
      }
      
      // Then add scores from the current game state as fallback
      Object.entries(game.scores).forEach(([playerId, points]) => {
        // Get the username for this player ID
        const username = getUsernameById(gameId, playerId);
        if (username) {
          // Only update if it doesn't exist or has a lower score (to prevent overwriting)
          if (scoresWithUsernames[username] === undefined || scoresWithUsernames[username] < points) {
            scoresWithUsernames[username] = points;
            console.log(`[PLAYER_MAPPING] Adding socket-based score: ${username} (${playerId}) = ${points}`);
          }
          
          // Also keep the socketId version for backward compatibility
          scoresWithUsernames[playerId] = points;
        } else {
          // Just keep the original if no username is found
          scoresWithUsernames[playerId] = points;
        }
      });
      
      // Check if this is the last round
      const isLastRound = currentRound >= game.maxRounds;
      
      // Broadcast vote results with enhanced user mapping
      io.to(gameId).emit('vote_result', {
        gameId,
        round: currentRound,
        votes: game.votes,
        correctPlayerId,
        correctPlayerUsername,
        scores: game.scores,
        scoresWithUsernames, // Add the username-keyed scores for better client handling
        isLastRound,
        // Add player mappings to help clients display correct names
        playerMappings: gameUsernameMappings[gameId] || {}
      });
      
      // Also broadcast a dedicated score update to ensure clients have the latest scores
      broadcastGameScores(gameId);
      
      // Reset votes for next round - extra reset to ensure votes are cleared
      game.votes = {};
    }
  });

  /*
  This code should work as implemented, the only thing we need to change is the actual gameID being sent to the
  websocket instead of the invite code.
  */
  // Handle advancing to next round
  socket.on('next_round', (data) => {
    const { gameId } = data;
    const game = activeGames[gameId];

    if (!game) {
      console.error(`[TRACK_SYNC] Game ${gameId} not found for next_round request`);
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    if (game.host !== socket.id) {
      console.error(`[TRACK_SYNC] Client ${socket.id} is not the host of game ${gameId}`);
      socket.emit('error', { message: 'Only the host can advance rounds' });
      return;
    }
    
    // Ensure we're starting with a valid current round
    if (!game.currentRound || game.currentRound < 1) {
      console.log(`[TRACK_SYNC] Game ${gameId} has invalid current round (${game.currentRound}), initializing to 1`);
      game.currentRound = 1;
    } else {
      // Increment the round number
      game.currentRound++;
    }
    
    console.log(`[TRACK_SYNC] Advancing game ${gameId} to round ${game.currentRound}`);
    
    // IMPORTANT: Clear all vote-related state
    // Clear votes completely to ensure fresh voting state
    game.votes = {};
    
    // Send a vote_reset event to ensure clients reset their UI state
    io.to(gameId).emit('vote_reset', {
      gameId,
      round: game.currentRound
    });
    
    // Clear client playing data to ensure a clean start for new round
    // This helps prevent desynchronization between rounds
    game.clientPlaying = {};
    
    // Create a trace ID for the new round
    const newRoundTraceId = `ROUND_${gameId}_${game.currentRound}_${Date.now()}`;
    game.currentRoundTraceId = newRoundTraceId;
    
    // Select the next song for this round
    const availableSongs = game.consolidatedPlaylist || [];
    
    if (!availableSongs || availableSongs.length === 0) {
      console.error(`[TRACK_SYNC] No songs available for game ${gameId}`);
      socket.emit('error', { message: 'No songs available for this round' });
      return;
    }
    
    // Check if we've already used all songs and need to recycle
    const maxRounds = Math.min(game.maxRounds || 3, availableSongs.length);
    const currentRoundIndex = (game.currentRound - 1) % availableSongs.length;
    
    // Log if we're starting to recycle songs
    if (game.currentRound > availableSongs.length) {
      console.log(`[TRACK_SYNC] Round ${game.currentRound} exceeds available songs (${availableSongs.length}), recycling tracks`);
    }
    
    // Select a song from the pool based on round index
    const selectedItem = availableSongs[currentRoundIndex];
    
    if (!selectedItem || !selectedItem.track) {
      console.error(`[TRACK_SYNC] Invalid song selected for round ${game.currentRound}`);
      socket.emit('error', { message: 'Failed to select a song for this round' });
      return;
    }
    
    // Check if this song is a user-provided track or a mock track
    const isMockTrack = selectedItem.track.isMockTrack || 
                        selectedItem.track.songTitle === "Bohemian Rhapsody" || 
                        selectedItem.track.songTitle === "Don't Stop Believin'" || 
                        selectedItem.track.songTitle === "Billie Jean";
    
    if (isMockTrack) {
      console.log(`[TRACK_SYNC] Using mock track: "${selectedItem.track.songTitle}" for round ${game.currentRound}`);
    } else {
      console.log(`[TRACK_SYNC] Using real user track: "${selectedItem.track.songTitle}" for round ${game.currentRound} (Track ${currentRoundIndex+1}/${availableSongs.length})`);
    }
    
    const selectedSong = selectedItem.track;
    const songOwner = selectedItem.owner;
    
    // Add the song to the round data with the trace ID
    const roundSong = {
      ...selectedSong,
      roundTraceId: newRoundTraceId,
      roundNumber: game.currentRound // Explicitly add round number to prevent confusion
    };
    
    console.log(`[TRACK_SYNC] Selected song for round ${game.currentRound}: "${roundSong.songTitle}" (Trace ID: ${newRoundTraceId})`);
    console.log(`[TRACK_SYNC] Song owner: ${songOwner.username}`);
    console.log(`[TRACK_SYNC] PreviewUrl available: ${!!roundSong.previewUrl}`);
    
    // Store the song in the game's round data
    if (!game.roundSongs) {
      game.roundSongs = {};
    }
    
    game.roundSongs[game.currentRound] = {
      song: {
        ...roundSong,
        assignedToPlayer: songOwner
      },
      owner: songOwner,
      roundTraceId: newRoundTraceId
    };


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
    
    // Notify all clients of the new round
    io.to(gameId).emit('round_started', {
      gameId,
      roundNumber: game.currentRound,
      song: {
        ...roundSong,
        assignedToPlayer: songOwner
      },
      roundTraceId: newRoundTraceId,
      votingReset: true, // Flag to tell clients to reset their voting UI
      // Add username mappings to ensure clients can match socket IDs to usernames
      playerMappings: gameUsernameMappings[gameId] || {}
    });
    
    console.log(`[TRACK_SYNC] Round ${game.currentRound} started for game ${gameId} with trace ID ${newRoundTraceId}`);
    
    // IMPORTANT: Initial force sync at the start of a new round
    // Schedule a slightly delayed force sync to ensure all clients are on the same page
    setTimeout(() => {
      forceSongSync(gameId);
    }, 500);
    
    return true;
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
    activeGames[gameId].clientPlaying = {}; // Clear song playing data
    activeGames[gameId].lastForceSyncTime = null; // Reset sync timestamp
    activeGames[gameId].lastInconsistencyDetectedForRound = null; // Reset inconsistency tracking
    activeGames[gameId].currentRoundTraceId = null; // Reset round trace ID
    
    // Reset scores - also reset username scores for this game
    Object.keys(activeGames[gameId].scores).forEach(playerId => {
      activeGames[gameId].scores[playerId] = 0;
    });
    
    // Reset username-based scores too
    if (gameUsernameScores[gameId]) {
      Object.keys(gameUsernameScores[gameId]).forEach(username => {
        gameUsernameScores[gameId][username] = 0;
      });
      
      console.log(`[PLAYER_MAPPING] Reset username scores for game ${gameId}`);
    }
    
    // Reset ready status for all players except host
    activeGames[gameId].players.forEach((player, index) => {
      if (player.id !== activeGames[gameId].host) {
        activeGames[gameId].players[index].ready = false;
      }
    });
    
    console.log(`[TRACK_SYNC] Game ${gameId} has been restarted`);
    
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
        // Get username before removing player
        const username = game.players[playerIndex].username;
        
        // Remove player from the game
        const removedPlayer = game.players.splice(playerIndex, 1)[0];
        
        // Don't delete the username mapping on disconnect - keep it for reconnection
        // Just log that we're preserving the mapping
        if (gameUsernameMappings[gameId] && gameUsernameMappings[gameId][username]) {
          console.log(`[PLAYER_MAPPING] Preserving mapping for ${username} in game ${gameId} despite disconnect`);
        }
        
        if (game.players.length === 0) {
          // Delete game if no players left
          delete activeGames[gameId];
          delete gameUsernameMappings[gameId]; // Clean up mappings for deleted game
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

  // Starts a round with a specific song
  function startRoundWithSong(gameId, roundNumber, song) {
    const game = activeGames[gameId];
    
    if (!game) {
      console.error(`[TRACK_SYNC] Game ${gameId} not found when starting round`);
      return;
    }
    
    // Set the current round in the game
    game.currentRound = roundNumber;
    
    // Prepare the round data
    const roundData = {
      gameId,
      roundNumber,
      song,
      roundTraceId: song.roundTraceId
    };
    
    // Reset any previous voting
    if (game.votes) {
      game.votes = {};
    }
    
    // Debug log before starting the round
    console.log(`[TRACK_SYNC] Round ${roundNumber} started for game ${gameId} with trace ID ${song.roundTraceId}`);
    
    // Notify all clients
    io.to(gameId).emit('round_started', roundData);
    
    // Schedule a check for song consistency after a short delay
    setTimeout(() => {
      checkSongConsistency(gameId);
    }, 2000);
  }
  
  // Checks if all clients are playing the same song in a game
  function checkSongConsistency(gameId) {
    const game = activeGames[gameId];
    
    if (!game) {
      console.error(`[TRACK_SYNC] Game ${gameId} not found for song consistency check`);
      return;
    }
    
    if (!game.clientPlaying) {
      console.warn(`[TRACK_SYNC] No client playing data available for game ${gameId}`);
      return;
    }
    
    // If we have fewer than 2 clients, no need to check consistency
    const clientIds = Object.keys(game.clientPlaying);
    if (clientIds.length < 2) {
      return;
    }
    
    // First verify that all clients report the correct round number
    let allRoundsSame = true;
    const expectedRound = game.currentRound;
    
    clientIds.forEach(clientId => {
      const clientRound = game.clientPlaying[clientId].roundNumber;
      if (clientRound !== expectedRound) {
        console.error(`[TRACK_SYNC] Client ${clientId} reports round ${clientRound} but game is on round ${expectedRound}`);
        allRoundsSame = false;
      }
    });
    
    // Force immediate sync if round numbers are inconsistent
    if (!allRoundsSame) {
      console.log(`[TRACK_SYNC] Round inconsistency detected, forcing immediate sync`);
      // Only sync if we haven't just done so
      const now = Date.now();
      if (!game.lastForceSyncTime || now - game.lastForceSyncTime > 1000) {
        forceSongSync(gameId);
        return;
      }
    }
    
    // Group clients by song title to find the majority song
    const songGroups = {};
    
    clientIds.forEach(clientId => {
      const songData = game.clientPlaying[clientId];
      const songKey = songData.songTitle;
      
      if (!songGroups[songKey]) {
        songGroups[songKey] = [];
      }
      songGroups[songKey].push({
        clientId,
        roundNumber: songData.roundNumber,
        traceId: songData.roundTraceId,
        hasPreviewUrl: !!songData.previewUrl
      });
    });
    
    // Find the song with the most clients
    let majorityGroup = null;
    let maxClients = 0;
    
    Object.keys(songGroups).forEach(songKey => {
      if (songGroups[songKey].length > maxClients) {
        maxClients = songGroups[songKey].length;
        majorityGroup = songKey;
      }
    });
    
    // Check if all clients are playing the same song
    const allConsistent = Object.keys(songGroups).length === 1;
    
    if (allConsistent) {
      console.log(`[TRACK_SYNC] All ${clientIds.length} clients in game ${gameId} are playing the same song: "${majorityGroup}"`);
    } else {
      console.log(`[TRACK_SYNC] WARNING: Not all clients in game ${gameId} are playing the same song!`);
      
      // If there are multiple different songs, log details
      console.log(`[TRACK_SYNC] Detailed song comparison for game ${gameId}:`);
      
      Object.keys(songGroups).forEach(songKey => {
        const group = songGroups[songKey];
        const isMajority = songKey === majorityGroup;
        console.log(`[TRACK_SYNC]   Clients playing "${songKey}": ${group.length} ${isMajority ? '(MAJORITY)' : ''}`);
        
        // Show details of first client in this group
        const firstClient = group[0];
        console.log(`[TRACK_SYNC]     Round: ${firstClient.roundNumber}, Has PreviewURL: ${firstClient.hasPreviewUrl}`);
      });
      
      // Force sync with more aggressive timing:
      // 1. Always force sync immediately if significant inconsistency (less than half playing same song)
      // 2. Force sync for any inconsistency if we haven't forced recently (last 3 seconds)
      // 3. Force sync if it's the first inconsistency for this round regardless of timing
      
      const significantInconsistency = maxClients < clientIds.length / 2;
      const isFirstInconsistencyForRound = !game.lastInconsistencyDetectedForRound || 
                                           game.lastInconsistencyDetectedForRound !== game.currentRound;
      
      const now = Date.now();
      const recentSync = game.lastForceSyncTime && (now - game.lastForceSyncTime <= 3000);
      
      if (significantInconsistency || isFirstInconsistencyForRound || !recentSync) {
        // Record that we detected an inconsistency for this round
        game.lastInconsistencyDetectedForRound = game.currentRound;
        
        console.log(`[TRACK_SYNC] CRITICAL: Detected song inconsistency in game ${gameId}. Forcing sync...`);
        forceSongSync(gameId);
      } else {
        const timeSinceLastSync = ((now - game.lastForceSyncTime) / 1000).toFixed(3);
        console.log(`[TRACK_SYNC] Skipping force sync - last sync was ${timeSinceLastSync} seconds ago`);
      }
    }
  }

  // Add the force sync handler to the song_playing event
  socket.on('song_playing', (data) => {
    const { gameId, roundNumber, songTitle, songArtists, roundTraceId, previewUrl, albumName, imageUrl, assignedToPlayer } = data;
    
    // Make sure game exists
    if (!activeGames[gameId]) {
      console.error(`[TRACK_SYNC] Game ${gameId} not found for song_playing event`);
      return;
    }
    
    const game = activeGames[gameId];
    
    // Check if this socket belongs to a player in the game
    const playerInGame = game.players.some(p => p.id === socket.id);
    if (!playerInGame) {
      // Instead of logging an error, add this socket to players with a generated username
      // This helps handle race conditions when clients connect
      console.log(`[TRACK_SYNC] Adding missing player ${socket.id} to game ${gameId}`);
      const tempUsername = `Player_${Math.floor(Math.random() * 1000)}`;
      
      game.players.push({
        id: socket.id,
        username: tempUsername,
        ready: true
      });
      
      // Initialize score for new player
      game.scores[socket.id] = 0;
      
      // Join the game room
      socket.join(gameId);
    }
    
    // Initialize song tracking if it doesn't exist
    if (!game.clientPlaying) {
      game.clientPlaying = {};
    }
    
    // Get the existing data for this client if available
    const previousData = game.clientPlaying[socket.id];
    const isFirstReport = !previousData;
    const isChangingRounds = previousData && previousData.roundNumber !== roundNumber;
    const isChangingSongs = previousData && previousData.songTitle !== songTitle;
    
    // IMPORTANT: More aggressive round number mismatch detection
    // Check if the client is out of sync with the game's current round
    if (roundNumber !== game.currentRound) {
      console.log(`[TRACK_SYNC] Round mismatch detected: Client reports round ${roundNumber}, game is on round ${game.currentRound}`);
      
      // Only sync if we haven't just done so very recently (within 1 second)
      const now = Date.now();
      if (!game.lastForceSyncTime || now - game.lastForceSyncTime > 1000) {
        console.log(`[TRACK_SYNC] Force syncing client to correct round immediately`);
        // Force sync to ensure client is on the right round
        forceSongSync(gameId);
        return;
      }
    }
    
    // Ensure the game has a valid current round
    if (!game.currentRound || game.currentRound < 1) {
      const oldRound = game.currentRound;
      game.currentRound = roundNumber;
      console.log(`[TRACK_SYNC] GAME STATE FIX: Game ${gameId} had invalid round number ${oldRound}, updated to client-reported round ${roundNumber}`);
      
      // Also log current game status to help diagnose issues
      console.log(`[TRACK_SYNC] Game status: ${game.status}, Players: ${game.players.length}, Host: ${game.host === socket.id ? 'THIS CLIENT' : 'OTHER CLIENT'}`);
      
      // If game is still in waiting status but clients are reporting songs, something is wrong
      if (game.status === 'waiting') {
        console.log(`[TRACK_SYNC] WARNING: Game is in waiting status but clients are already playing songs!`);
        // Force game to playing status
        game.status = 'playing';
        console.log(`[TRACK_SYNC] Forcing game status to 'playing'`);
      }
    }
    
    // Check if this client is sending the same song data repeatedly
    if (previousData && 
        previousData.songTitle === songTitle && 
        previousData.roundTraceId === roundTraceId) {
      // Same song, same trace ID - this is a duplicate message, just log it
      // This is normal as clients confirm sync status
      console.log(`[TRACK_SYNC] Client ${socket.id} confirmed still playing "${songTitle}" (round ${roundNumber})`);
    } else {
      // New song data, log it more prominently
      console.log(`[TRACK_SYNC] Client ${socket.id} is playing "${songTitle}" in round ${roundNumber}`);
      
      // If this is the first report or the client is changing songs/rounds, we should consider force sync
      if (isFirstReport || isChangingRounds || isChangingSongs) {
        // Also check if the song matches the expected song for this round
        const expectedSong = game.roundSongs && game.roundSongs[roundNumber];
        if (expectedSong && expectedSong.song) {
          const expectedTitle = expectedSong.song.songTitle || expectedSong.song.title;
          if (expectedTitle && expectedTitle !== songTitle) {
            console.log(`[TRACK_SYNC] Song mismatch: Client playing "${songTitle}", expected "${expectedTitle}" for round ${roundNumber}`);
            
            // Only sync if we haven't just done so very recently (within 1 second)
            const now = Date.now();
            if (!game.lastForceSyncTime || now - game.lastForceSyncTime > 1000) {
              console.log(`[TRACK_SYNC] Force syncing client to correct song immediately`);
              // Force sync to ensure client plays the right song
              forceSongSync(gameId);
              return;
            }
          }
        }
      }
    }
    
    // Look up assigned player if provided or try to find from consolidated playlist
    let songAssignedPlayer = assignedToPlayer;
    
    // If no player assignment was provided, try to find it from the consolidated playlist
    if (!songAssignedPlayer && game.consolidatedPlaylist) {
      const playlist = game.consolidatedPlaylist;
      // Try to find the current song in the playlist
      const matchingSong = playlist.find(item => 
        item.track.songTitle === songTitle || 
        (item.track.previewUrl && item.track.previewUrl === previewUrl)
      );
      
      if (matchingSong && matchingSong.owner) {
        songAssignedPlayer = matchingSong.owner;
        console.log(`[TRACK_SYNC] Found song ownership in playlist: ${songTitle} belongs to ${songAssignedPlayer.username}`);
      } else if (playlist.length > 0) {
        // If we can't find a match, use the round number to determine ownership (cycle through playlist)
        const roundIndex = (roundNumber - 1) % playlist.length;
        songAssignedPlayer = playlist[roundIndex].owner;
        console.log(`[TRACK_SYNC] Assigned ${songTitle} to ${songAssignedPlayer.username} based on round number`);
      }
    }
    
    // If still no assigned player, use a fallback (host)
    if (!songAssignedPlayer) {
      // Use host as fallback owner
      const hostPlayer = game.players.find(p => p.id === game.host);
      if (hostPlayer) {
        songAssignedPlayer = {
          id: hostPlayer.id,
          username: hostPlayer.username
        };
        console.log(`[TRACK_SYNC] Using fallback player assignment (host): ${hostPlayer.username}`);
      }
    }
    
    // Record what song this client is playing with complete data
    game.clientPlaying[socket.id] = {
      roundNumber,
      songTitle,
      songArtists,
      albumName,
      imageUrl,
      roundTraceId,
      previewUrl,
      assignedToPlayer: songAssignedPlayer,
      timestamp: new Date().toISOString()
    };
    
    // Store the song data in the round songs collection for this game
    // This ensures we have a record of all songs for each round
    if (!game.roundSongs) {
      game.roundSongs = {};
    }
    
    // Only update round song if it doesn't exist or this is from the host
    if (!game.roundSongs[roundNumber] || socket.id === game.host) {
      game.roundSongs[roundNumber] = {
        song: {
          songTitle,
          songArtists,
          albumName,
          imageUrl,
          roundTraceId,
          previewUrl,
          assignedToPlayer: songAssignedPlayer
        },
        timestamp: new Date().toISOString()
      };
      
      console.log(`[TRACK_SYNC] Updated round ${roundNumber} song data in game ${gameId}`);
      if (songAssignedPlayer) {
        console.log(`[TRACK_SYNC] Song "${songTitle}" is assigned to player: ${songAssignedPlayer.username}`);
      } else {
        console.warn(`[TRACK_SYNC] WARNING: No player assignment for song "${songTitle}"`);
      }
    }
    
    // Check if all clients in the game are playing the same song
    const clientSongs = Object.values(game.clientPlaying || {});
    
    if (clientSongs.length > 1) {
      // Track songs by trace ID to determine consistency
      const songsByTraceId = {};
      
      clientSongs.forEach(songInfo => {
        const traceId = songInfo.roundTraceId || 'no-trace';
        if (!songsByTraceId[traceId]) {
          songsByTraceId[traceId] = [];
        }
        songsByTraceId[traceId].push(songInfo);
      });
      
      // Find the most common trace ID
      let dominantTraceId = null;
      let maxCount = 0;
      
      Object.entries(songsByTraceId).forEach(([traceId, songs]) => {
        if (songs.length > maxCount) {
          maxCount = songs.length;
          dominantTraceId = traceId;
        }
      });
      
      // Check if all clients are on the same song (by trace ID)
      const allSame = Object.keys(songsByTraceId).length === 1;
      
      if (allSame) {
        console.log(`[TRACK_SYNC] All ${clientSongs.length} clients in game ${gameId} are playing the same song: "${clientSongs[0].songTitle}"`);
      } else {
        console.error(`[TRACK_SYNC] WARNING: Not all clients in game ${gameId} are playing the same song!`);
        
        // If this is the first song report from this client for this round, force sync immediately
        // This helps new clients joining mid-round
        if (isFirstReport) {
          console.log(`[TRACK_SYNC] First song report from client ${socket.id}, forcing immediate sync`);
          forceSongSync(gameId);
          return;
        }
        
        // IMPORTANT: Lower the threshold for force sync (3 seconds instead of 5)
        // To increase sync frequency when clients are out of sync
        const now = Date.now();
        const lastForceSyncTime = game.lastForceSyncTime || 0;
        
        if (now - lastForceSyncTime > 3000) {
          console.log(`[TRACK_SYNC] Detailed song comparison for game ${gameId}:`);
          
          // Log each client's song with detailed info
          Object.entries(game.clientPlaying).forEach(([clientId, songInfo]) => {
            const traceId = songInfo.roundTraceId || 'no-trace';
            const isDominant = traceId === dominantTraceId;
            console.log(`[TRACK_SYNC]   Client ${clientId}: "${songInfo.songTitle}" (Trace ID: ${traceId}) ${isDominant ? '(MAJORITY)' : ''}`);
            console.log(`[TRACK_SYNC]     Round: ${songInfo.roundNumber}, Has PreviewURL: ${!!songInfo.previewUrl}`);
          });
          
          // Force a song sync to ensure all clients are playing the same song
          game.lastForceSyncTime = now;
          forceSongSync(gameId);
        } else {
          console.log(`[TRACK_SYNC] Skipping force sync - last sync was ${(now - lastForceSyncTime) / 1000} seconds ago`);
        }
      }
    }
  });

  // Handle song error reports from clients
  socket.on('song_error', (data) => {
    const { gameId, roundNumber, error, songTitle } = data;
    
    console.error(`[TRACK_SYNC] Client ${socket.id} reported song error: ${error} for "${songTitle}" in game ${gameId}`);
    
    if (!activeGames[gameId]) return;
    
    // Log the error in the game state
    if (!activeGames[gameId].songErrors) {
      activeGames[gameId].songErrors = [];
    }
    
    activeGames[gameId].songErrors.push({
      clientId: socket.id,
      error,
      songTitle,
      roundNumber,
      timestamp: Date.now()
    });
    
    // Check if we should trigger a different song for all clients
    if (error === 'missing_preview_url') {
      console.error(`[TRACK_SYNC] Song "${songTitle}" missing preview URL. Attempting emergency song change.`);
      
      // Find an alternative song with a preview URL
      const clientSongs = Object.values(activeGames[gameId].clientPlaying || {});
      const alternativeSong = clientSongs.find(song => 
        song.songTitle !== songTitle && song.previewUrl
      );
      
      if (alternativeSong) {
        console.log(`[TRACK_SYNC] Found alternative song "${alternativeSong.songTitle}" with preview URL. Forcing sync.`);
        
        // Create a trace ID for this emergency sync
        const emergencySyncTraceId = `EMERGENCY_SONG_CHANGE_${gameId}_R${roundNumber}_${Date.now()}`;
        
        // Use this song for emergency sync
        const syncSong = {
          songTitle: alternativeSong.songTitle,
          songArtists: alternativeSong.songArtists ? 
            (Array.isArray(alternativeSong.songArtists) ? alternativeSong.songArtists : [alternativeSong.songArtists]) : 
            ['Unknown Artist'],
          albumName: alternativeSong.albumName || 'Unknown Album',
          imageUrl: alternativeSong.imageUrl || 'https://via.placeholder.com/300',
          previewUrl: alternativeSong.previewUrl,
          roundTraceId: emergencySyncTraceId
        };
        
        // Force all clients to sync to this song
        io.to(gameId).emit('force_song_sync', {
          gameId,
          roundNumber,
          song: syncSong,
          roundTraceId: emergencySyncTraceId,
          // Add username mappings to ensure clients can match socket IDs to usernames
          playerMappings: gameUsernameMappings[gameId] || {}
        });
        
        console.log(`[TRACK_SYNC] Emergency song change signal sent to all clients in game ${gameId}`);
      } else {
        console.error(`[TRACK_SYNC] No alternative songs with preview URLs found. Cannot perform emergency sync.`);
      }
    }
  });

  // Forces all clients to synchronize to the current song
  function forceSongSync(gameId) {
    const game = activeGames[gameId];
    
    if (!game) {
      console.error(`[TRACK_SYNC] Game ${gameId} not found for force sync`);
      return;
    }
    
    // Set a timestamp for the last force sync
    const now = Date.now();
    game.lastForceSyncTime = now;
    const syncTimestamp = new Date().toISOString();
    
    console.log(`[TRACK_SYNC] Executing force sync at ${syncTimestamp} for round ${game.currentRound}`);
    
    // Make sure we have a valid current round
    if (!game.currentRound || game.currentRound < 1) {
      console.error(`[TRACK_SYNC] Game ${gameId} has invalid current round: ${game.currentRound}`);
      // Use 1 as fallback round number
      game.currentRound = 1;
      console.log(`[TRACK_SYNC] Corrected round number to 1`);
    }
    
    // Initialize scores object if it doesn't exist
    if (!game.scores) {
      game.scores = {};
      game.players.forEach(player => {
        game.scores[player.id] = 0;
      });
      console.log(`[TRACK_SYNC] Initialized game scores`);
    }
    
    // Choose the song to use for sync:
    // 1. First try to use the proper song for the current round
    // 2. If not available, use the song that corresponds to the current round in the consolidated playlist
    // 3. If still not clear, use the song played by the majority of clients
    
    console.log(`[TRACK_SYNC] Current round: ${game.currentRound}`);
    console.log(`[TRACK_SYNC] Round songs available:`, Object.keys(game.roundSongs || {}));
    
    // Option 1: Try to use the proper song for the current round
    if (game.roundSongs && game.roundSongs[game.currentRound]) {
      const roundSong = game.roundSongs[game.currentRound];
      
      console.log(`[TRACK_SYNC] Using song from game.roundSongs for round ${game.currentRound}:`, {
        title: roundSong.song ? roundSong.song.songTitle : (roundSong.title || 'Unknown'),
        artists: roundSong.song ? 
          (Array.isArray(roundSong.song.songArtists) ? roundSong.song.songArtists.join(', ') : roundSong.song.songArtists) : 
          (roundSong.artists || 'Unknown'),
        hasPreviewUrl: roundSong.song ? !!roundSong.song.previewUrl : !!roundSong.previewUrl,
        assignedPlayer: roundSong.song ? 
          (roundSong.song.assignedToPlayer ? roundSong.song.assignedToPlayer.username : 'unknown') : 
          'unknown'
      });
      
      // Create a new trace ID for this force sync
      const syncTraceId = `FORCESYNC_G${gameId}_R${game.currentRound}_${now}`;
      
      // Construct the sync song data
      const syncSong = roundSong.song ? {
        ...roundSong.song,
        roundTraceId: syncTraceId,
        roundNumber: game.currentRound // Explicitly include the round number
      } : {
        title: roundSong.title || 'Unknown Song',
        artists: roundSong.artists || 'Unknown Artist',
        albumName: roundSong.albumName || 'Unknown Album',
        imageUrl: roundSong.imageUrl || 'https://via.placeholder.com/300',
        previewUrl: roundSong.previewUrl,
        roundTraceId: syncTraceId,
        roundNumber: game.currentRound, // Explicitly include the round number
        assignedPlayer: roundSong.assignedPlayer || 'unknown'
      };
      
      console.log(`[TRACK_SYNC] Forcing song sync with "${syncSong.title || syncSong.songTitle}" (Trace ID: ${syncTraceId})`);
      console.log(`[TRACK_SYNC] Preview URL present: ${!!(syncSong.previewUrl)}`);
      
      if (syncSong.previewUrl) {
        console.log(`[TRACK_SYNC] Preview URL: ${syncSong.previewUrl.substring(0, 40)}...`);
      }
      
      // Send the force sync command to all clients
      io.to(gameId).emit('force_song_sync', {
        gameId,
        roundNumber: game.currentRound,
        song: syncSong,
        roundTraceId: syncTraceId,
        syncTimestamp: syncTimestamp,
        scores: game.scores, // Include current scores to ensure consistency
        votingReset: true, // Flag to reset voting UI state
        // Add username mappings to ensure clients can match socket IDs to usernames
        playerMappings: gameUsernameMappings[gameId] || {}
      });
      
      console.log(`[TRACK_SYNC] Force sync sent to all clients in game ${gameId} at ${syncTimestamp}`);
      
      // Schedule another sync check after a short delay to ensure everyone got the message
      setTimeout(() => {
        checkSongConsistency(gameId);
      }, 2000);
      
      return;
    }
    
    // Option 2: Use a song from the consolidated playlist based on the current round
    if (game.consolidatedPlaylist && game.consolidatedPlaylist.length > 0) {
      // Get the song that corresponds to the current round
      const currentRoundIndex = (game.currentRound - 1) % game.consolidatedPlaylist.length;
      const roundBasedSong = game.consolidatedPlaylist[currentRoundIndex];
      
      if (roundBasedSong && roundBasedSong.track) {
        // Use the song matching the current round
        const syncTraceId = `FORCESYNC_ROUND_G${gameId}_R${game.currentRound}_${now}`;
        
        // Construct the sync song data
        const syncSong = {
          songTitle: roundBasedSong.track.songTitle,
          songArtists: roundBasedSong.track.songArtists,
          albumName: roundBasedSong.track.albumName || 'Unknown Album',
          imageUrl: roundBasedSong.track.imageUrl || 'https://via.placeholder.com/300',
          previewUrl: roundBasedSong.track.previewUrl,
          roundTraceId: syncTraceId,
          roundNumber: game.currentRound, // Explicitly include the round number
          assignedToPlayer: roundBasedSong.owner
        };
        
        console.log(`[TRACK_SYNC] Using round-appropriate song for sync: "${syncSong.songTitle}" (Round ${game.currentRound}, Track ${currentRoundIndex+1}/${game.consolidatedPlaylist.length})`);
        console.log(`[TRACK_SYNC] Preview URL present: ${!!syncSong.previewUrl}`);
        
        // Store this as the proper song for this round
        if (!game.roundSongs) {
          game.roundSongs = {};
        }
        
        game.roundSongs[game.currentRound] = {
          song: syncSong,
          owner: roundBasedSong.owner,
          roundTraceId: syncTraceId
        };
        
        // Send the force sync command to all clients
        io.to(gameId).emit('force_song_sync', {
          gameId,
          roundNumber: game.currentRound,
          song: syncSong,
          roundTraceId: syncTraceId,
          syncTimestamp: syncTimestamp,
          scores: game.scores, // Include current scores to ensure consistency
          votingReset: true, // Flag to reset voting UI state
          // Add username mappings to ensure clients can match socket IDs to usernames
          playerMappings: gameUsernameMappings[gameId] || {}
        });
        
        console.log(`[TRACK_SYNC] Force sync sent to all clients in game ${gameId} at ${syncTimestamp}`);
        
        // Schedule another sync check after a short delay to ensure everyone got the message
        setTimeout(() => {
          checkSongConsistency(gameId);
        }, 2000);
        
        return;
      }
    }
    
    // Option 3: Try using the song played by the majority of clients
    if (game.clientPlaying && Object.keys(game.clientPlaying).length > 0) {
      // Group songs by title
      const songCounts = {};
      const songDataByTitle = {};
      
      Object.entries(game.clientPlaying).forEach(([clientId, songInfo]) => {
        const songTitle = songInfo.songTitle;
        
        if (!songCounts[songTitle]) {
          songCounts[songTitle] = 0;
          songDataByTitle[songTitle] = songInfo;
        }
        
        songCounts[songTitle]++;
        
        // Use the song data with a preview URL if available
        if (songInfo.previewUrl && !songDataByTitle[songTitle].previewUrl) {
          songDataByTitle[songTitle] = songInfo;
        }
      });
      
      // Find the song with the most clients
      let majoritySongTitle = null;
      let maxCount = 0;
      
      Object.entries(songCounts).forEach(([title, count]) => {
        if (count > maxCount) {
          maxCount = count;
          majoritySongTitle = title;
        }
      });
      
      if (majoritySongTitle) {
        const majoritySong = songDataByTitle[majoritySongTitle];
        
        // Create a trace ID for this force sync
        const syncTraceId = `FORCESYNC_MAJORITY_G${gameId}_R${game.currentRound}_${now}`;
        
        // Construct the sync song data
        const syncSong = {
          songTitle: majoritySong.songTitle,
          songArtists: majoritySong.songArtists ? 
            (Array.isArray(majoritySong.songArtists) ? majoritySong.songArtists : [majoritySong.songArtists]) : 
            ['Unknown Artist'],
          albumName: majoritySong.albumName || 'Unknown Album',
          imageUrl: majoritySong.imageUrl || 'https://via.placeholder.com/300',
          previewUrl: majoritySong.previewUrl,
          roundTraceId: syncTraceId,
          roundNumber: game.currentRound, // Explicitly include the round number
          assignedToPlayer: majoritySong.assignedToPlayer
        };
        
        console.log(`[TRACK_SYNC] Forcing majority song sync with "${syncSong.songTitle}" (Trace ID: ${syncTraceId})`);
        console.log(`[TRACK_SYNC] Preview URL present: ${!!syncSong.previewUrl}`);
        
        if (syncSong.previewUrl) {
          console.log(`[TRACK_SYNC] Preview URL: ${syncSong.previewUrl.substring(0, 40)}...`);
        }
        
        // Store this as the proper song for this round
        if (!game.roundSongs) {
          game.roundSongs = {};
        }
        
        game.roundSongs[game.currentRound] = {
          song: syncSong,
          owner: majoritySong.assignedToPlayer,
          roundTraceId: syncTraceId
        };
        
        // Send the force sync command to all clients
        io.to(gameId).emit('force_song_sync', {
          gameId,
          roundNumber: game.currentRound,
          song: syncSong,
          roundTraceId: syncTraceId,
          syncTimestamp: syncTimestamp,
          scores: game.scores, // Include current scores to ensure consistency
          votingReset: true, // Flag to reset voting UI state
          // Add username mappings to ensure clients can match socket IDs to usernames
          playerMappings: gameUsernameMappings[gameId] || {}
        });
        
        console.log(`[TRACK_SYNC] Force sync sent to all clients in game ${gameId} at ${syncTimestamp}`);
        
        // Schedule another sync check after a short delay to ensure everyone got the message
        setTimeout(() => {
          checkSongConsistency(gameId);
        }, 2000);
        
        return;
      }
    }
    
    // If we get here, try fallback to any song with a valid preview URL
    if (game.consolidatedPlaylist && game.consolidatedPlaylist.length > 0) {
      // Find a song with a preview URL
      const validSongs = game.consolidatedPlaylist.filter(item => !!item.track.previewUrl);
      
      if (validSongs.length > 0) {
        // Use the first valid song
        const fallbackSong = validSongs[0];
        
        // Create a trace ID for this force sync
        const syncTraceId = `FORCESYNC_FALLBACK_G${gameId}_R${game.currentRound}_${now}`;
        
        // Construct the sync song data
        const syncSong = {
          songTitle: fallbackSong.track.songTitle,
          songArtists: fallbackSong.track.songArtists,
          albumName: fallbackSong.track.albumName || 'Unknown Album',
          imageUrl: fallbackSong.track.imageUrl || 'https://via.placeholder.com/300',
          previewUrl: fallbackSong.track.previewUrl,
          roundTraceId: syncTraceId,
          roundNumber: game.currentRound, // Explicitly include the round number
          assignedToPlayer: fallbackSong.owner
        };
        
        console.log(`[TRACK_SYNC] Forcing fallback song sync with "${syncSong.songTitle}" (Trace ID: ${syncTraceId})`);
        console.log(`[TRACK_SYNC] Preview URL present: ${!!syncSong.previewUrl}`);
        
        // Send the force sync command to all clients
        io.to(gameId).emit('force_song_sync', {
          gameId,
          roundNumber: game.currentRound,
          song: syncSong,
          roundTraceId: syncTraceId,
          syncTimestamp: syncTimestamp,
          scores: game.scores, // Include current scores to ensure consistency
          votingReset: true, // Flag to reset voting UI state
          // Add username mappings to ensure clients can match socket IDs to usernames
          playerMappings: gameUsernameMappings[gameId] || {}
        });
        
        console.log(`[TRACK_SYNC] Force sync sent to all clients in game ${gameId} at ${syncTimestamp}`);
        
        // Schedule another sync check after a short delay to ensure everyone got the message
        setTimeout(() => {
          checkSongConsistency(gameId);
        }, 2000);
        
        return;
      }
    }
    
    // If all else fails, use an emergency mock track
    console.error(`[TRACK_SYNC] CRITICAL: No valid song found for force sync in game ${gameId}`);
    
    // Create an emergency track
    const emergencyTrack = {
      songTitle: "Emergency Fallback Song",
      songArtists: ["System"],
      albumName: "Emergency",
      imageUrl: "https://via.placeholder.com/300",
      previewUrl: "https://p.scdn.co/mp3-preview/1f3bd078c7ad27b427fa210f6efd957fc5eecea0", // Bohemian Rhapsody as fallback
      roundTraceId: `EMERGENCY_G${gameId}_R${game.currentRound}_${now}`,
      roundNumber: game.currentRound, // Explicitly include the round number
      isMockTrack: true
    };
    
    // Send the emergency track to all clients
    io.to(gameId).emit('force_song_sync', {
      gameId,
      roundNumber: game.currentRound,
      song: emergencyTrack,
      roundTraceId: emergencyTrack.roundTraceId,
      syncTimestamp: syncTimestamp,
      scores: game.scores, // Include current scores to ensure consistency
      votingReset: true, // Flag to reset voting UI state
      // Add username mappings to ensure clients can match socket IDs to usernames
      playerMappings: gameUsernameMappings[gameId] || {}
    });
    
    console.log(`[TRACK_SYNC] Emergency song sync sent to all clients in game ${gameId} at ${syncTimestamp}`);
  }

  // Add a new handler for clients requesting score updates
  socket.on('request_score_update', (data) => {
    const { gameId } = data;
    if (!activeGames[gameId]) return;
    
    console.log(`[PLAYER_MAPPING] Client ${socket.id} requested score update for game ${gameId}`);
    broadcastGameScores(gameId);
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
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server is ready for connections`); console.log(`Server accessible at http://172.20.10.10:${PORT}`);
  });
}

// Export the function and other necessary components
module.exports = {
  generateSimpleGameCode,
  app,
  server,
  io,
  activeGames,
  gameUsernameMappings,
  getPlayerIdByUsername,
  getUsernameById
}; 

// Add helper functions for username/socketID mapping

// Get a player's socket ID by username
function getPlayerIdByUsername(gameId, username) {
  // Check if we have a direct mapping first
  if (gameUsernameMappings[gameId] && gameUsernameMappings[gameId][username]) {
    return gameUsernameMappings[gameId][username];
  }
  
  // Fall back to player list if no direct mapping
  if (activeGames[gameId]) {
    const player = activeGames[gameId].players.find(p => p.username === username);
    return player ? player.id : null;
  }
  
  return null;
}

// Get a username by socket ID
function getUsernameById(gameId, socketId) {
  // Check direct mapping first (reverse lookup)
  if (gameUsernameMappings[gameId]) {
    for (const [username, id] of Object.entries(gameUsernameMappings[gameId])) {
      if (id === socketId) return username;
    }
  }
  
  // Fall back to player list
  if (activeGames[gameId]) {
    const player = activeGames[gameId].players.find(p => p.id === socketId);
    return player ? player.username : null;
  }
  
  return null;
} 