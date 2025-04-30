# Synth Multiplayer Mode

This guide explains how to set up and use the multiplayer functionality of the Synth music game.

## Overview

The multiplayer feature allows multiple players on the same WiFi network to play together in real-time. One player hosts the game server, and others connect to it to join games.

## Setup Instructions

### 1. Server Setup

Before players can join multiplayer games, someone needs to run the WebSocket server:

1. Navigate to the server directory:
   ```
   cd server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm start
   ```

4. Note your computer's local IP address:
   - On Mac: System Preferences → Network
   - On Windows: Run `ipconfig` in Command Prompt
   - The IP typically looks like `192.168.x.x`

5. The server will be running at `http://YOUR_IP_ADDRESS:3000`

### 2. Player Setup

#### Host Player:
1. Open the Synth app and go to "Multiplayer Mode"
2. If needed, tap "Configure Server" and enter the server URL (`http://YOUR_IP_ADDRESS:3000`)
3. Connect to the server
4. Enter your name
5. Select "Create a Game"
6. Enter a game name and create the game
7. Share the game code with other players
8. Wait for players to join and mark themselves as ready
9. Start the game when everyone is ready

#### Joining Players:
1. Open the Synth app and go to "Multiplayer Mode"
2. If needed, tap "Configure Server" and enter the server URL (`http://YOUR_IP_ADDRESS:3000`)
3. Connect to the server
4. Enter your name
5. Select "Join a Game"
6. Enter the game code provided by the host
7. Mark yourself as ready when you're prepared to play
8. Wait for the host to start the game

## How Multiplayer Works

- **Real-time Synchronization**: All game actions are synchronized across devices via WebSockets
- **Host Control**: The host player controls the game flow, including starting the game and advancing rounds
- **Song Selection**: Songs are selected by the server and synchronized to all players
- **Voting**: Players vote on who they think each song belongs to
- **Scores**: Scores are tracked in real-time and visible to all players
- **Resilience**: If the host leaves, a new host is automatically assigned

## Troubleshooting

- **Can't Connect to Server**: Ensure all devices are on the same WiFi network and the server IP address is correct
- **Game Not Found**: Double-check the game code is entered correctly
- **Disconnections**: If a player disconnects, they can rejoin using the same game code
- **Server Crashes**: Restart the server and have players reconnect

## Technical Details

The multiplayer implementation uses:
- Node.js and Express for the server
- Socket.io for WebSockets communication
- React Native for the client interface

For developers looking to extend this functionality, the code is structured as follows:
- `server/server.js`: The WebSocket server implementation
- `utils/useWebSocket.js`: React hook for client WebSocket communication
- `app/multiplayer-game.js`: The multiplayer game UI and logic 