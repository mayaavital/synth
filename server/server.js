const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

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
    // Generate a simple game code instead of using timestamp
    let gameId = generateSimpleGameCode();
    
    // Make sure the game code is unique
    while (activeGames[gameId]) {
      gameId = generateSimpleGameCode();
    }
    
    const gameName = gameData.gameName || 'Untitled Game';
    
    // Create game room with the simple code (not prefixed with "game-")
    activeGames[gameId] = {
      id: gameId,
      name: gameName,
      host: socket.id,
      players: [{ id: socket.id, username: gameData.hostUsername || 'Host', ready: true }],
      status: 'waiting',
      currentRound: 0,
      maxRounds: gameData.maxRounds || 3,
      currentSong: null,
      roundSongs: {},
      votes: {},
      scores: {},
      clientPlaying: {}, // Track what songs each client is playing
      currentRoundTraceId: null // Track the current round's trace ID
    };
    
    socket.join(gameId);
    console.log(`Game created: ${gameId} by ${socket.id}`);
    
    // Emit game created event
    socket.emit('game_created', { gameId, game: activeGames[gameId] });
  });

  // Handle joining a game
  socket.on('join_game', (data) => {
    const { gameId, username, profilePicture, playerTracks } = data;
    
    if (!activeGames[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    // Check if game is full
    if (activeGames[gameId].players.length >= 7) {
      socket.emit('error', { message: 'Game is full' });
      return;
    }
    
    console.log(`[TRACK_SYNC] Player ${username} (${socket.id}) joining game ${gameId} with ${playerTracks?.length || 0} tracks`);
    
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
    const existingPlayerIndex = activeGames[gameId].players.findIndex(p => p.username === username);
    
    if (existingPlayerIndex !== -1) {
      // Player with this username already exists
      // Update their socket ID instead of adding a duplicate
      const oldSocketId = activeGames[gameId].players[existingPlayerIndex].id;
      
      // Update the player's socket ID
      activeGames[gameId].players[existingPlayerIndex].id = socket.id;
      activeGames[gameId].players[existingPlayerIndex].profilePicture = profilePicture || null;
      
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
        activeGames[gameId].scores[socket.id] = activeGames[gameId].scores[oldSocketId];
        delete activeGames[gameId].scores[oldSocketId];
      } else {
        activeGames[gameId].scores[socket.id] = 0;
      }
      
      // If this player was the host, update the host reference
      if (activeGames[gameId].host === oldSocketId) {
        activeGames[gameId].host = socket.id;
      }
      
      socket.join(gameId);
      console.log(`Player reconnected: ${username} to game ${gameId} (replaced socket ID ${oldSocketId} with ${socket.id})`);
      
      // Notify everyone in the room about the updated game state
      io.to(gameId).emit('player_joined', {
        game: activeGames[gameId],
        newPlayer: { 
          id: socket.id, 
          username,
          profilePicture: profilePicture || null
        }
      });
    } else {
      // Add new player to game
      activeGames[gameId].players.push({
        id: socket.id,
        username,
        profilePicture: profilePicture || null,
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
      activeGames[gameId].scores[socket.id] = 0;
      
      // Notify everyone in the room about the new player
      io.to(gameId).emit('player_joined', {
        game: activeGames[gameId],
        newPlayer: { 
          id: socket.id, 
          username,
          profilePicture: profilePicture || null
        }
      });
    }
  });

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
              roundTraceId: round1TraceId
            });
            
            console.log(`[TRACK_SYNC] Round 1 auto-started for game ${gameId}`);
          } else {
            console.error(`[TRACK_SYNC] Cannot auto-start round 1: No consolidated playlist available`);
          }
        }
      }
    }
  });

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
        roundTraceId: round1TraceId
      });
      
      console.log(`[TRACK_SYNC] Round 1 auto-started for game ${gameId}`);
    }
  });

  // Helper function to prepare tracks for the game
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
      console.warn(`[TRACK_SYNC] WARNING: Game ${gameId} has no player tracks, using fallback tracks`);
      addMockTracksToGame(game);
      return game.consolidatedPlaylist;
    }
    
    console.log(`[TRACK_SYNC] Processing tracks from ${Object.keys(game.playerTracks).length} players`);
    
    // Get all available tracks with consistent processing
    let allTracks = [];
    let trackOwnership = {};
    let tracksWithPreviewURLs = [];
    let hostTracks = [];  // Tracks from the host player
    
    // First pass - validate and collect tracks from all players
    Object.keys(game.playerTracks).forEach(playerId => {
      const playerTracks = game.playerTracks[playerId];
      const playerInfo = game.players.find(p => p.id === playerId);
      const isHostPlayer = playerId === game.host;
      
      if (!playerTracks || !Array.isArray(playerTracks) || playerTracks.length === 0) {
        console.warn(`[TRACK_SYNC] Player ${playerInfo?.username || playerId} has no valid tracks`);
        return;
      }
      
      // Process both tracks with and without preview URLs
      console.log(`[TRACK_SYNC] Processing ${playerTracks.length} tracks from ${playerInfo?.username || playerId}`);
      
      // First collect all tracks regardless of preview URL
      let playerValidTracks = [];
      let playerTracksWithPreview = [];
      
      playerTracks.forEach((track, index) => {
        // Skip invalid tracks
        if (!track) {
          console.log(`[TRACK_SYNC] Skipping invalid track #${index + 1} from ${playerInfo?.username || playerId}`);
          return;
        }

        // Generate a unique track ID if not provided
        const trackId = track.trackId || track.uri || `track_${playerId}_${index}`;
        
        // Create a standardized track object
        const standardizedTrack = {
          songTitle: track.songTitle?.trim() || 'Unknown Song',
          songArtists: Array.isArray(track.songArtists) ? 
            track.songArtists.map(a => a?.name || a).filter(Boolean) : 
            [track.songArtists?.toString() || 'Unknown Artist'],
          albumName: track.albumName?.trim() || 'Unknown Album',
          imageUrl: track.imageUrl || 'https://via.placeholder.com/300',
          previewUrl: track.previewUrl, // Keep this null/undefined if not available
          uri: track.uri || null,
          trackId: trackId,
          duration: track.duration || 0,
          ownerId: playerId,
          owner: {
            id: playerId,
            username: playerInfo?.username || 'Unknown Player'
          }
        };
        
        playerValidTracks.push(standardizedTrack);
        
        // Also track tracks with preview URLs separately
        if (track.previewUrl) {
          playerTracksWithPreview.push(standardizedTrack);
          console.log(`[TRACK_SYNC] Track "${standardizedTrack.songTitle}" has valid preview URL`);
        } else {
          console.log(`[TRACK_SYNC] Track "${standardizedTrack.songTitle}" has NO preview URL`);
        }
      });
      
      // Store all valid tracks regardless of preview URL
      allTracks.push(...playerValidTracks);
      
      // Track ownership for all tracks
      playerValidTracks.forEach(track => {
        trackOwnership[track.trackId] = {
          id: playerId,
          username: playerInfo?.username || 'Unknown Player'
        };
      });
      
      // Track tracks with preview URLs separately
      tracksWithPreviewURLs.push(...playerTracksWithPreview);
      
      // Keep host tracks separate to prioritize them
      if (isHostPlayer) {
        hostTracks.push(...playerValidTracks);
        console.log(`[TRACK_SYNC] Collected ${playerValidTracks.length} tracks from host, ${playerTracksWithPreview.length} with preview URLs`);
      }
    });
    
    console.log(`[TRACK_SYNC] Collected ${allTracks.length} valid tracks total`);
    console.log(`[TRACK_SYNC] ${tracksWithPreviewURLs.length} tracks have preview URLs`);
    console.log(`[TRACK_SYNC] ${hostTracks.length} tracks from host player`);
    
    // Track selection logic:
    // 1. Prefer tracks with preview URLs if available
    // 2. If host has tracks, prioritize those
    let selectedTracks = [];
    
    if (tracksWithPreviewURLs.length > 0) {
      // Prioritize host tracks with preview URLs
      const hostTracksWithPreview = hostTracks.filter(track => track.previewUrl);
      
      if (hostTracksWithPreview.length > 0) {
        console.log(`[TRACK_SYNC] Using ${hostTracksWithPreview.length} host tracks with preview URLs`);
        selectedTracks = [...hostTracksWithPreview];
      } else {
        console.log(`[TRACK_SYNC] Using ${tracksWithPreviewURLs.length} tracks with preview URLs from all players`);
        selectedTracks = [...tracksWithPreviewURLs];
      }
    } else {
      // If no tracks have preview URLs, use mock tracks
      console.error(`[TRACK_SYNC] No tracks have preview URLs, using fallback tracks`);
      addMockTracksToGame(game);
      return game.consolidatedPlaylist;
    }
    
    // Shuffle the tracks for round assignments
    console.log(`[TRACK_SYNC] Shuffling ${selectedTracks.length} tracks for rounds`);
    shuffleArray(selectedTracks);
    
    // If we have fewer tracks than maxRounds, adjust maxRounds
    if (selectedTracks.length < game.maxRounds) {
      console.warn(`[TRACK_SYNC] Not enough tracks (${selectedTracks.length}) for requested rounds (${game.maxRounds}). Adjusting max rounds.`);
      game.maxRounds = Math.max(selectedTracks.length, 1);
    }
    
    // Create the consolidated playlist
    game.consolidatedPlaylist = selectedTracks.map(track => ({
      track: {
        songTitle: track.songTitle,
        songArtists: Array.isArray(track.songArtists) ? [...track.songArtists] : [track.songArtists],
        albumName: track.albumName,
        imageUrl: track.imageUrl,
        previewUrl: track.previewUrl,
        uri: track.uri,
        trackId: track.trackId,
        duration: track.duration || 30000
      },
      owner: trackOwnership[track.trackId] || {
        id: track.ownerId,
        username: track.owner?.username || 'Unknown Player'
      }
    }));
    
    // Log the finalized playlist for debugging
    console.log(`[TRACK_SYNC] Final playlist for game ${gameId} (${game.consolidatedPlaylist.length} tracks):`);
    game.consolidatedPlaylist.forEach((item, index) => {
      console.log(`[TRACK_SYNC]   ${index+1}. "${item.track.songTitle}" by ${Array.isArray(item.track.songArtists) ? item.track.songArtists.join(', ') : item.track.songArtists} (from ${item.owner.username})`);
      console.log(`[TRACK_SYNC]       Preview URL: ${item.track.previewUrl ? 'Available' : 'Missing'}`);
    });
    
    return game.consolidatedPlaylist;
  }
  
  // Helper function to add mock/fallback tracks to a game that doesn't have enough
  function addMockTracksToGame(game) {
    const mockTracks = [
      {
        songTitle: "Bohemian Rhapsody",
        songArtists: ["Queen"],
        albumName: "A Night at the Opera",
        imageUrl: "https://i.scdn.co/image/ab67616d0000b2739f39192f4f0fae773d3f8a95",
        previewUrl: "https://p.scdn.co/mp3-preview/1f3bd078c7ad27b427fa210f6efd957fc5eecea0",
        duration: 354000,
      },
      {
        songTitle: "Don't Stop Believin'",
        songArtists: ["Journey"],
        albumName: "Escape",
        imageUrl: "https://i.scdn.co/image/ab67616d0000b273c5653f9038e42efad2f8def2",
        previewUrl: "https://p.scdn.co/mp3-preview/21b9abd3cd2eea634e17a917196fdd5ba2e82670",
        duration: 250000,
      },
      {
        songTitle: "Billie Jean",
        songArtists: ["Michael Jackson"],
        albumName: "Thriller",
        imageUrl: "https://i.scdn.co/image/ab67616d0000b2734121faee8df82c526cbab2be",
        previewUrl: "https://p.scdn.co/mp3-preview/f504e6b8e037771318656394f532dede4f9bcaea",
        duration: 294000,
      }
    ];
    
    // Distribute mock tracks among players
    if (game.players && game.players.length > 0) {
      console.log(`[TRACK_SYNC] Creating mock playlist with ${mockTracks.length} tracks for ${game.players.length} players`);
      
      // Clear existing consolidated playlist
      game.consolidatedPlaylist = [];
      
      // Assign each mock track to a player
      mockTracks.forEach((track, index) => {
        const playerIndex = index % game.players.length;
        const player = game.players[playerIndex];
        
        const trackId = `mock_track_${index}`;
        
        game.consolidatedPlaylist.push({
          track: {
            songTitle: track.songTitle,
            songArtists: track.songArtists,
            albumName: track.albumName,
            imageUrl: track.imageUrl,
            previewUrl: track.previewUrl,
            duration: track.duration,
            trackId: trackId
          },
          owner: {
            id: player.id,
            username: player.username
          }
        });
        
        console.log(`[TRACK_SYNC] Added mock track "${track.songTitle}" assigned to ${player.username}`);
      });
      
      // Set max rounds based on mock track count
      game.maxRounds = Math.min(game.maxRounds || 3, mockTracks.length);
      console.log(`[TRACK_SYNC] Set max rounds to ${game.maxRounds} based on available mock tracks`);
    } else {
      console.error(`[TRACK_SYNC] Cannot add mock tracks - no players in game`);
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
    
    // If we only have username, look up the corresponding player ID
    if (!targetPlayerId && votedForUsername) {
      const targetPlayer = game.players.find(p => p.username === votedForUsername);
      if (targetPlayer) {
        targetPlayerId = targetPlayer.id;
        console.log(`Resolved username ${votedForUsername} to player ID ${targetPlayerId}`);
      } else {
        console.log(`Could not find player with username ${votedForUsername}`);
      }
    }

    // Make sure we have a valid player ID format to vote for
    game.votes[socket.id] = targetPlayerId;
    
    console.log(`Player ${socket.id} voted for ${targetPlayerId || votedForUsername} in round ${currentRound}`);
    
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
      
      // Award points for correct guesses FIRST
      Object.entries(game.votes).forEach(([voterId, votedForId]) => {
        // Award points for correct guesses
        if (String(votedForId) === String(correctPlayerId) && voterId !== correctPlayerId) {
          game.scores[voterId] = (game.scores[voterId] || 0) + 1;
          console.log(`Player ${voterId} earned 1 point for correct guess`);
        }
      });
      
      // Award points to track owner for fooling others
      if (correctPlayerId) {
        let fooledCount = 0;
        Object.entries(game.votes).forEach(([voterId, votedForId]) => {
          // Count incorrect votes (excluding the owner's own vote)
          if (voterId !== correctPlayerId && String(votedForId) !== String(correctPlayerId)) {
            fooledCount++;
          }
        });
        
        if (fooledCount > 0) {
          game.scores[correctPlayerId] = (game.scores[correctPlayerId] || 0) + fooledCount;
          console.log(`Player ${correctPlayerId} (${correctPlayerUsername}) earned ${fooledCount} points for fooling others`);
        }
      }
      
      // Check if this is the last round
      const isLastRound = currentRound >= game.maxRounds;
      
      // Broadcast vote results
      io.to(gameId).emit('vote_result', {
        gameId,
        round: currentRound,
        votes: game.votes,
        correctPlayerId,
        correctPlayerUsername,
        scores: game.scores,
        isLastRound
      });
      
      // Reset votes for next round
      game.votes = {};
    }
  });

  // Request handler for advancing to the next round
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
    
    // Reset voting for the new round
    game.votes = {};
    
    // Create a trace ID for the new round
    const newRoundTraceId = `ROUND_${gameId}_${game.currentRound}_${Date.now()}`;
    game.currentRoundTraceId = newRoundTraceId;
    
    // Select the next song for this round
    // In the shared song pool implementation, we'll pick a song from the consolidated pool
    const availableSongs = game.consolidatedPlaylist || [];
    
    if (!availableSongs || availableSongs.length === 0) {
      console.error(`[TRACK_SYNC] No songs available for game ${gameId}`);
      socket.emit('error', { message: 'No songs available for this round' });
      return;
    }
    
    // Select a random song from the pool
    const roundIndex = (game.currentRound - 1) % availableSongs.length;
    const selectedItem = availableSongs[roundIndex];
    
    if (!selectedItem || !selectedItem.track) {
      console.error(`[TRACK_SYNC] Invalid song selected for round ${game.currentRound}`);
      socket.emit('error', { message: 'Failed to select a song for this round' });
      return;
    }
    
    const selectedSong = selectedItem.track;
    const songOwner = selectedItem.owner;
    
    // Add the song to the round data with the trace ID
    const roundSong = {
      ...selectedSong,
      roundTraceId: newRoundTraceId
    };
    
    console.log(`[TRACK_SYNC] Selected song for round ${game.currentRound}: "${roundSong.songTitle}" (Trace ID: ${newRoundTraceId})`);
    console.log(`[TRACK_SYNC] Song owner: ${songOwner.username}`);
    console.log(`[TRACK_SYNC] PreviewUrl available: ${!!roundSong.previewUrl}`);
    
    // Store the song in the game's round data
    if (!game.roundSongs) {
      game.roundSongs = {};
    }
    game.roundSongs[game.currentRound] = {
      song: roundSong,
      owner: songOwner,
      roundTraceId: newRoundTraceId
    };
    
    // Notify all clients of the new round
    io.to(gameId).emit('round_started', {
      gameId,
      roundNumber: game.currentRound,
      song: roundSong,
      roundTraceId: newRoundTraceId
    });
    
    console.log(`[TRACK_SYNC] Round ${game.currentRound} started for game ${gameId} with trace ID ${newRoundTraceId}`);
    
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

  // Function to check for song consistency and force sync if needed
  function checkSongConsistency(gameId) {
    const game = activeGames[gameId];
    if (!game || !game.clientPlaying) return;
    
    // Check if game is configured properly for syncing
    if (game.status !== 'playing') {
      console.log(`[TRACK_SYNC] Game ${gameId} not in playing state yet (${game.status}), skipping sync check`);
      return;
    }
    
    const clientSongs = Object.values(game.clientPlaying || {});
    if (clientSongs.length <= 1) return;
    
    const firstSong = clientSongs[0];
    const allSame = clientSongs.every(song => 
      song.songTitle === firstSong.songTitle && 
      song.roundTraceId === firstSong.roundTraceId
    );
    
    if (!allSame) {
      console.error(`[TRACK_SYNC] CRITICAL: Detected song inconsistency in game ${gameId}. Forcing sync...`);
      
      // CRITICAL FIX: Handle round 0 immediately before any other processing
      if (!game.currentRound || game.currentRound === 0) {
        console.error(`[TRACK_SYNC] Cannot force sync - game round is ${game.currentRound}. Setting to round 1 and using client data.`);
        
        // Force to round 1
        game.currentRound = 1;
        console.log(`[TRACK_SYNC] Forced game round to 1`);
        
        // Find client with the best song data
        console.log(`[TRACK_SYNC] Clients playing songs:`, Object.keys(game.clientPlaying).length);
        
        // Find most common song among clients or one with the best data
        const songCounts = {};
        const songDataByTitle = {};
        
        // Count frequency of each song and collect song data
        Object.entries(game.clientPlaying).forEach(([clientId, songInfo]) => {
          const songTitle = songInfo.songTitle;
          songCounts[songTitle] = (songCounts[songTitle] || 0) + 1;
          
          // Store song data if it has preview URL or is more complete
          if (!songDataByTitle[songTitle] || 
              (!songDataByTitle[songTitle].previewUrl && songInfo.previewUrl)) {
            songDataByTitle[songTitle] = songInfo;
          }
        });
        
        // Find most common song
        let bestSongTitle = Object.keys(songCounts)[0];
        let maxCount = songCounts[bestSongTitle] || 0;
        
        Object.entries(songCounts).forEach(([title, count]) => {
          if (count > maxCount || 
              (count === maxCount && songDataByTitle[title].previewUrl && !songDataByTitle[bestSongTitle].previewUrl)) {
            bestSongTitle = title;
            maxCount = count;
          }
        });
        
        // Get the best song data
        const bestSong = songDataByTitle[bestSongTitle];
        console.log(`[TRACK_SYNC] Selected best song "${bestSongTitle}" played by ${maxCount} clients`);
        
        if (bestSong) {
          // Create a trace ID for this emergency sync
          const forceSyncTraceId = `EMERGENCY_SYNC_${gameId}_R1_${Date.now()}`;
          
          // Create a song object for sync
          const syncSong = {
            songTitle: bestSong.songTitle,
            songArtists: bestSong.songArtists ? 
              (Array.isArray(bestSong.songArtists) ? bestSong.songArtists : [bestSong.songArtists]) : 
              ['Unknown Artist'],
            albumName: bestSong.albumName || 'Unknown Album',
            imageUrl: bestSong.imageUrl || 'https://via.placeholder.com/300',
            previewUrl: bestSong.previewUrl,
            roundTraceId: forceSyncTraceId
          };
          
          console.log(`[TRACK_SYNC] EMERGENCY SYNC: Using "${syncSong.songTitle}" as source of truth`);
          console.log(`[TRACK_SYNC] Has preview URL: ${!!syncSong.previewUrl}`);
          
          // Force all clients to sync to this song
          io.to(gameId).emit('force_song_sync', {
            gameId,
            roundNumber: 1,
            song: syncSong,
            roundTraceId: forceSyncTraceId
          });
          
          console.log(`[TRACK_SYNC] Emergency sync signal sent to all clients in game ${gameId}`);
          return;
        } else {
          console.error(`[TRACK_SYNC] CRITICAL ERROR: Could not find any valid song data for emergency sync`);
          return;
        }
      }
      
      // Continue with normal flow for non-zero rounds
      // Log available round data
      console.log(`[TRACK_SYNC] Current round: ${game.currentRound}`);
      console.log(`[TRACK_SYNC] Round songs available:`, Object.keys(game.roundSongs || {}));
      
      // Get the correct song from the round data
      const correctSong = game.roundSongs[game.currentRound];
      
      if (!correctSong || !correctSong.song) {
        console.error(`[TRACK_SYNC] Cannot find correct song for round ${game.currentRound}`);
        
        // If we can't find the song for the current round, try to use the first client's song
        // This is a fallback to at least get all clients on the same song
        if (firstSong && firstSong.songTitle) {
          console.log(`[TRACK_SYNC] Using first client's song as fallback: "${firstSong.songTitle}"`);
          
          // Create a trace ID for this forced sync
          const forceSyncTraceId = `FORCESYNC_FALLBACK_G${gameId}_R${game.currentRound}_${Date.now()}`;
          
          // Find the client with the most complete song data
          let bestSong = firstSong;
          let hasFoundPreviewUrl = !!firstSong.previewUrl;
          
          if (!hasFoundPreviewUrl) {
            console.log(`[TRACK_SYNC] Searching for client with valid previewUrl...`);
            // Search all clients for a valid previewUrl
            Object.entries(game.clientPlaying || {}).forEach(([clientId, songData]) => {
              if (songData.previewUrl) {
                console.log(`[TRACK_SYNC] Found client ${clientId} with valid previewUrl`);
                bestSong = songData;
                hasFoundPreviewUrl = true;
              }
            });
          }
          
          // Create a minimalist song object from what we know
          const fallbackSong = {
            songTitle: bestSong.songTitle,
            songArtists: bestSong.songArtists ? 
              (Array.isArray(bestSong.songArtists) ? bestSong.songArtists : [bestSong.songArtists]) : 
              ['Unknown Artist'],
            roundTraceId: forceSyncTraceId,
            previewUrl: bestSong.previewUrl,
            albumName: bestSong.albumName || 'Unknown Album',
            imageUrl: bestSong.imageUrl || 'https://via.placeholder.com/300'
          };

          // CRITICAL: Verify and log preview URL for debugging
          console.log(`[TRACK_SYNC] Fallback song has previewUrl: ${!!fallbackSong.previewUrl}`);
          if (fallbackSong.previewUrl) {
            console.log(`[TRACK_SYNC] Fallback previewUrl: ${fallbackSong.previewUrl.substring(0, 40)}...`);
          } else {
            console.error(`[TRACK_SYNC] WARNING: Fallback song has no previewUrl, sync likely to fail`);
          }
          
          // Send the force_sync event to all clients
          io.to(gameId).emit('force_song_sync', {
            gameId,
            roundNumber: game.currentRound,
            song: fallbackSong,
            roundTraceId: forceSyncTraceId
          });
          
          console.log(`[TRACK_SYNC] Force sync sent with fallback song "${fallbackSong.songTitle}"`);
        } else {
          console.error(`[TRACK_SYNC] No valid fallback song available. Sync failed.`);
        }
        return;
      }
      
      // Create a trace ID for this forced sync
      const forceSyncTraceId = `FORCESYNC_G${gameId}_R${game.currentRound}_${Date.now()}`;
      
      // Log the song we're using for sync
      console.log(`[TRACK_SYNC] Using song from game.roundSongs:`, {
        title: correctSong.song.songTitle,
        artists: Array.isArray(correctSong.song.songArtists) ? 
          correctSong.song.songArtists.join(',') : correctSong.song.songArtists,
        hasPreviewUrl: !!correctSong.song.previewUrl,
        previewUrl: correctSong.song.previewUrl ? correctSong.song.previewUrl.substring(0, 30) + '...' : 'NONE'
      });
      
      // Prepare the correct song data to send to all clients
      const syncSongData = {
        ...correctSong.song,
        roundTraceId: forceSyncTraceId
      };
      
      // CRITICAL: Verify previewUrl is actually present in the data
      if (!syncSongData.previewUrl) {
        console.error(`[TRACK_SYNC] ERROR: Force sync song is missing previewUrl!`);
        // Try to find a client with a valid previewUrl
        const clientWithPreviewUrl = Object.values(game.clientPlaying || {}).find(song => song.previewUrl);
        if (clientWithPreviewUrl) {
          console.log(`[TRACK_SYNC] Found client with valid previewUrl, using that instead`);
          syncSongData.previewUrl = clientWithPreviewUrl.previewUrl;
        } else {
          console.error(`[TRACK_SYNC] No clients have a valid previewUrl, force sync likely to fail`);
        }
      }
      
      console.log(`[TRACK_SYNC] Forcing song sync with "${syncSongData.songTitle}" (Trace ID: ${forceSyncTraceId})`);
      console.log(`[TRACK_SYNC] Preview URL present: ${!!syncSongData.previewUrl}`);
      if (syncSongData.previewUrl) {
        console.log(`[TRACK_SYNC] Preview URL: ${syncSongData.previewUrl.substring(0, 40)}...`);
      }
      
      // Send the force_sync event to all clients in the game
      io.to(gameId).emit('force_song_sync', {
        gameId,
        roundNumber: game.currentRound,
        song: syncSongData,
        roundTraceId: forceSyncTraceId
      });
      
      // Log what we're syncing to
      console.log(`[TRACK_SYNC] Force sync sent to all clients in game ${gameId}`);
    }
  }

  // Add the force sync handler to the song_playing event
  socket.on('song_playing', (data) => {
    const { gameId, roundNumber, songTitle, songArtists, roundTraceId, previewUrl, albumName, imageUrl, assignedToPlayer } = data;
    
    if (!activeGames[gameId]) return;
    
    // Initialize song tracking if it doesn't exist
    if (!activeGames[gameId].clientPlaying) {
      activeGames[gameId].clientPlaying = {};
    }
    
    // Ensure the game has a valid current round
    if (!activeGames[gameId].currentRound || activeGames[gameId].currentRound < 1) {
      const oldRound = activeGames[gameId].currentRound;
      activeGames[gameId].currentRound = roundNumber;
      console.log(`[TRACK_SYNC] GAME STATE FIX: Game ${gameId} had invalid round number ${oldRound}, updated to client-reported round ${roundNumber}`);
      
      // Also log current game status to help diagnose issues
      console.log(`[TRACK_SYNC] Game status: ${activeGames[gameId].status}, Players: ${activeGames[gameId].players.length}, Host: ${activeGames[gameId].host === socket.id ? 'THIS CLIENT' : 'OTHER CLIENT'}`);
      
      // If game is still in waiting status but clients are reporting songs, something is wrong
      if (activeGames[gameId].status === 'waiting') {
        console.log(`[TRACK_SYNC] WARNING: Game is in waiting status but clients are already playing songs!`);
        // Force game to playing status
        activeGames[gameId].status = 'playing';
        console.log(`[TRACK_SYNC] Forcing game status to 'playing'`);
      }
    }
    
    // Check if this client is sending the same song data repeatedly
    const previousData = activeGames[gameId].clientPlaying[socket.id];
    if (previousData && 
        previousData.songTitle === songTitle && 
        previousData.roundTraceId === roundTraceId) {
      // Same song, same trace ID - this is a duplicate message, just log it
      // This is normal as clients confirm sync status
      console.log(`[TRACK_SYNC] Client ${socket.id} confirmed still playing "${songTitle}" (round ${roundNumber})`);
    } else {
      // New song data, log it more prominently
      console.log(`[TRACK_SYNC] Client ${socket.id} is playing "${songTitle}" in round ${roundNumber}`);
    }
    
    // Look up assigned player if provided or try to find from consolidated playlist
    let songAssignedPlayer = assignedToPlayer;
    
    // If no player assignment was provided, try to find it from the consolidated playlist
    if (!songAssignedPlayer && activeGames[gameId].consolidatedPlaylist) {
      const playlist = activeGames[gameId].consolidatedPlaylist;
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
      const hostPlayer = activeGames[gameId].players.find(p => p.id === activeGames[gameId].host);
      if (hostPlayer) {
        songAssignedPlayer = {
          id: hostPlayer.id,
          username: hostPlayer.username
        };
        console.log(`[TRACK_SYNC] Using fallback player assignment (host): ${hostPlayer.username}`);
      }
    }
    
    // Record what song this client is playing with complete data
    activeGames[gameId].clientPlaying[socket.id] = {
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
    if (!activeGames[gameId].roundSongs) {
      activeGames[gameId].roundSongs = {};
    }
    
    // Only update round song if it doesn't exist or this is from the host
    if (!activeGames[gameId].roundSongs[roundNumber] || socket.id === activeGames[gameId].host) {
      activeGames[gameId].roundSongs[roundNumber] = {
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
    const game = activeGames[gameId];
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
        
        // Only trigger a force sync if we haven't done so recently (last 5 seconds)
        const now = Date.now();
        const lastForceSyncTime = game.lastForceSyncTime || 0;
        
        if (now - lastForceSyncTime > 5000) {
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
          checkSongConsistency(gameId);
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
          roundTraceId: emergencySyncTraceId
        });
        
        console.log(`[TRACK_SYNC] Emergency song change signal sent to all clients in game ${gameId}`);
      } else {
        console.error(`[TRACK_SYNC] No alternative songs with preview URLs found. Cannot perform emergency sync.`);
      }
    }
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
  activeGames
}; 