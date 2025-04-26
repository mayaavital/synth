import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  Dimensions,
  LogBox,
} from "react-native";
import { colors } from "./assets/colors";

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

export default function App() {
  return (
    <View style={styles.container}>
      <Pressable style={styles.connectSpotify} onPress={() => getSpotifyAuth()}>
        <Image
          source={require("assets/spotify-logo.png")}
          style={styles.spotifyLogo}
        />
        <Text style={styles.text}>Login with Spotify</Text>
      </Pressable>

      <Pressable
        style={styles.connectApple}
        marginTop={windowHeight * 0.01}
        onPress={() => getSpotifyAuth()}
      >
        <Image
          source={require("assets/apple-music.png")}
          style={styles.spotifyLogo}
        />
        <Text style={styles.text}>Login with Apple Music</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  connectSpotify: {
    backgroundColor: colors.spotify,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: (windowHeight * 0.1) / 2,
    height: windowHeight * 0.05,
    width: windowWidth * 0.6,
  },
  connectApple: {
    backgroundColor: colors.apple,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: (windowHeight * 0.1) / 2,
    height: windowHeight * 0.05,
    width: windowWidth * 0.6,
  },
  spotifyLogo: {
    height: windowWidth * 0.08,
    width: windowWidth * 0.08,
  },
});
