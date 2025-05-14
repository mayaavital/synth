/**
 * Server-side patch for the infinite force_sync loop issue
 * 
 * Steps to use:
 * 1. Add this code to the top of your server.js file
 * 2. Restart the server
 * 
 * This patch adds timestamp-based throttling to prevent sync storms
 */

// Track last sync timestamps per game to prevent excessive syncing
const lastSyncTimestamps = {};
const SYNC_THROTTLE_MS = 5000; // Minimum 5 seconds between syncs

// Patched checkSongConsistency function that adds throttling
const originalCheckSongConsistency = checkSongConsistency;
checkSongConsistency = function(gameId) {
  const game = activeGames[gameId];
  if (!game || !game.clientPlaying) return;
  
  // Check if we've synced too recently for this game
  const now = Date.now();
  if (lastSyncTimestamps[gameId] && (now - lastSyncTimestamps[gameId] < SYNC_THROTTLE_MS)) {
    console.log(`[TRACK_SYNC] Skipping sync check for game ${gameId} - throttled (last sync ${now - lastSyncTimestamps[gameId]}ms ago)`);
    return;
  }
  
  // Update last sync timestamp
  lastSyncTimestamps[gameId] = now;
  
  // Check if comparing traceIDs only is causing the problem
  // Instead, compare just song titles as a less strict comparison
  const clientSongs = Object.values(game.clientPlaying || {});
  if (clientSongs.length <= 1) return;
  
  const firstSong = clientSongs[0];
  
  // Relax the sync criterion - only check song titles match, not trace IDs
  const allSameSongs = clientSongs.every(song => song.songTitle === firstSong.songTitle);
  
  // If all songs match by title, consider them synchronized even if traceIDs differ
  if (allSameSongs) {
    console.log(`[TRACK_SYNC] All clients in game ${gameId} are playing the same song title: "${firstSong.songTitle}" (with different trace IDs)`);
    return;
  }
  
  // Otherwise, continue with original logic for song mismatch
  originalCheckSongConsistency(gameId);
};

console.log('[SERVER] Installed throttle-fix patch to prevent sync storms');
