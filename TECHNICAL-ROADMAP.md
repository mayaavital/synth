# Technical Roadmap: Multiplayer Song Contribution

This roadmap outlines the implementation plan for enhancing the multiplayer functionality to allow all players to contribute songs to the game, rather than just the host.

## 1. Data Model Enhancements

### Server-Side
- ✅ Add `playerTracks` object to store each player's contributed tracks
- ✅ Modify player objects to support profile pictures
- ✅ Create `trackAssignments` to map songs to player IDs
- ✅ Update voting logic to award points to song owners

### Client-Side
- ✅ Add state for tracking player tracks
- ✅ Update data structures to handle expanded game model

## 2. API & WebSocket Events

### New/Modified Server Events
- ✅ Enhanced `JOIN_GAME` to accept player tracks
- ✅ Added `PLAYER_TRACKS_RECEIVED` event
- ✅ Updated `ROUND_STARTED` event with song data
- ✅ Enhanced `VOTE_RESULT` with correct player attribution

### Client-Side Event Handling
- 📝 Update WebSocket event listeners in `game-play.js`
- 📝 Implement round and voting UI updates

## 3. Implementation Steps

### Phase 1: Server-Side Implementation (Complete)
- ✅ Update `server.js` to receive tracks during player join
- ✅ Implement track selection when game starts
- ✅ Update round advancement to use prepared tracks
- ✅ Enhance voting to properly track song ownership

### Phase 2: Client-Side Implementation
1. **Song Collection**
   - ✅ Implement `fetchRecentTracks()` in `multiplayer-game.js`
   - ✅ Update game creation/joining to submit player tracks

2. **Multiplayer Game Flow**
   - 📝 Update `game-play.js` to use pre-selected songs from server
   - 📝 Remove host-only song selection UI
   - 📝 Add UI for showing track ownership during results

3. **Voting & Scoring**
   - 📝 Enhance voting UI to show all players
   - 📝 Update score display to show points from song ownership
   - 📝 Implement leaderboard with attribution

### Phase 3: Testing & Refinement
- 📝 Test with multiple players
- 📝 Validate point calculation
- 📝 Handle edge cases (player disconnection, etc.)

## 4. UI Changes (Minimal)

- Keep existing UI structure but:
  - Show all player profile photos in voting screen
  - Add "song owner" indicator in results screen
  - Update score display to show points from correctly guessing and from fooling others

## 5. Implementation Timeline

1. **Day 1**: Complete server-side changes ✅
2. **Day 2**: Implement client-side song collection ✅
3. **Day 3**: Update game flow and voting in client
4. **Day 4**: Testing and refinement

## 6. API Integration Considerations

- Both Spotify API implementation and mock data for testing are supported
- Track selection is resilient to preview URL availability issues
- Songs are attributed to players with proper error handling 