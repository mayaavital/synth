import axios from "axios";
import getEnv from "./env";

const {
  SPOTIFY_API: { TOP_TRACKS_API, ALBUM_TRACK_API_GETTER },
} = getEnv();

// Add Spotify Recently Played API endpoint
const RECENTLY_PLAYED_API = "https://api.spotify.com/v1/me/player/recently-played?limit=50";

const ERROR_ALERT = new Error(
  "Oh no! Something went wrong; probably a malformed request or a network error.\nCheck console for more details."
);

/* Pulls out the relevant data from the API response and puts it in a nicely structured object. */
const formatter = (data) =>
  data.map((val) => {
    const artists = val.artists?.map((artist) => ({ name: artist.name }));
    // returning undefined for now to not confuse students, ideally a fix would be a hosted version of this
    return {
      songTitle: val.name,
      songArtists: artists.map(artist => artist.name),
      albumName: val.album?.name,
      imageUrl: val.album?.images[0]?.url ?? undefined,
      duration: val.duration_ms,
      externalUrl: val.external_urls?.spotify ?? undefined,
      previewUrl: val.preview_url ?? undefined,
      // Add additional fields required by the specifications
      uri: val.uri ?? undefined,
      // Including additional useful fields
      trackId: val.id ?? undefined,
      popularity: val.popularity ?? undefined,
      albumReleaseDate: val.album?.release_date ?? undefined,
    };
  });

/* Fetches data from the given endpoint URL with the access token provided. */
const fetcher = async (url, token) => {
  try {
    return await axios(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    });
  } catch (error) {
    console.log("Fetcher error: ", error);
  }
};

/* Fetches your top tracks from the Spotify API.
 * Make sure that TOP_TRACKS_API is set correctly in env.js */
export const getMyTopTracks = async (token) => {
  try {
    let res = await fetcher(TOP_TRACKS_API, token);
    return formatter(res.data?.items);
  } catch (e) {
    console.error(e);
    alert(ERROR_ALERT);
    return null;
  }
};

/* Fetches the given album from the Spotify API.
 * Make sure that ALBUM_TRACK_API_GETTER is set correctly in env.js */
export const getAlbumTracks = async (albumId, token) => {
  try {
    console.log("ALBUM_TRACK_ID", ALBUM_TRACK_API_GETTER(albumId));
    const res = await fetcher(ALBUM_TRACK_API_GETTER(albumId), token);
    const transformedResponse = res.data?.tracks?.items?.map((item) => {
      item.album = { images: res.data?.images, name: res.data?.name };
      return item;
    });
    return formatter(transformedResponse);
  } catch (e) {
    console.error(e);
    alert(ERROR_ALERT);
    return null;
  }
};

/* Fetches your recently played tracks from the Spotify API. */
export const getMyRecentlyPlayedTracks = async (token) => {
  try {
    const res = await fetcher(RECENTLY_PLAYED_API, token);
    
    // The recently played API returns a different format than the top tracks API
    // We need to extract the track from each item
    const tracks = res.data?.items?.map(item => item.track);
    
    if (!tracks || tracks.length === 0) {
      console.warn("No recently played tracks found");
      return [];
    }
    
    return formatter(tracks);
  } catch (e) {
    console.error("Error fetching recently played tracks:", e);
    alert(ERROR_ALERT);
    return null;
  }
};
