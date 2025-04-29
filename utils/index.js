import millisToMinutesAndSeconds from "./millisToMinutesAndSeconds";
import useSpotifyAuth from "./useSpotifyAuth";
import { 
  searchDeezerTracks, 
  getDeezerTrackById, 
  findDeezerTrackFromSpotify, 
  enrichTracksWithDeezerPreviews 
} from "./deezerApi";

export { 
  millisToMinutesAndSeconds, 
  useSpotifyAuth,
  // Deezer API functions
  searchDeezerTracks,
  getDeezerTrackById,
  findDeezerTrackFromSpotify,
  enrichTracksWithDeezerPreviews
};
