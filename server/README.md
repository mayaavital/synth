# Synth WebSocket Server

This is the WebSocket server for the Synth multiplayer game using Socket.io. It enables real-time game synchronization between multiple players on the same WiFi network.

## Features

- Real-time game state synchronization
- Player join/leave handling
- Game lifecycle management (creation, starting, rounds, completion)
- Voting and scoring system
- Automatic host reassignment when host leaves

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Start the server:
   ```
   npm start
   ```
   
   For development with auto-restart:
   ```
   npm run dev
   ```

## Server Information

- The server runs on port 3000 by default
- You can access the server status at http://localhost:3000
- Active games can be listed at http://localhost:3000/games

## For Local Network Use

To allow other devices on the same WiFi network to connect:

1. Find your computer's local IP address:
   - On Mac: System Preferences → Network
   - On Windows: Run `ipconfig` in Command Prompt

2. Players should connect to: `http://YOUR_LOCAL_IP:3000`

## Event Documentation

### Server Events (emitted by the server)

- `game_created` - When a new game is created
- `player_joined` - When a player joins a game
- `game_updated` - When the game state is updated
- `game_started` - When the game starts
- `song_selected` - When a song is selected for a round
- `vote_result` - Player-specific vote result
- `player_voted` - When a player casts a vote
- `round_complete` - When all players have voted in a round
- `round_started` - When a new round starts
- `game_completed` - When the game is completed
- `game_restarted` - When the game is restarted
- `host_changed` - When the host changes
- `player_left` - When a player leaves
- `error` - When an error occurs

### Client Events (expected from clients)

- `create_game` - Create a new game
- `join_game` - Join an existing game
- `player_ready` - Mark player as ready
- `start_game` - Start the game
- `select_song` - Select a song for a round
- `cast_vote` - Cast a vote
- `next_round` - Advance to the next round
- `restart_game` - Restart the game 