import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  Dimensions,
  require,
} from "react-native";
//import { colors } from "./assets/colors";
import { useRouter } from "expo-router";

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

export default function App() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.synth_container}>
        <Text style={styles.synth_text}>SYNTH</Text>
      </View>
      <Pressable
        style={styles.connectSpotify}
        onPress={() => router.push("home")}
      >
        <Image
          source={"../assets/spotify-logo.png"}
          style={styles.spotifyLogo}
        />
        <Text style={styles.text}>Login with Spotify</Text>
      </Pressable>

      <Pressable
        style={styles.connectApple}
        marginTop={windowHeight * 0.01}
        onPress={() => getSpotifyAuth()}
      >
        <Image source={"./assets/apple-music.png"} style={styles.spotifyLogo} />
        <Text style={styles.text}>Login with Apple Music</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    //backgroundColor: colors.background,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
  },
  connectSpotify: {
    // backgroundColor: colors.spotify,
    backgroundColor: "#C6E1B8",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: (windowHeight * 0.1) / 2,
    height: windowHeight * 0.08,
    width: windowWidth * 0.7,
  },
  connectApple: {
    // backgroundColor: colors.apple,
    backgroundColor: "#F1D5EE",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: (windowHeight * 0.1) / 2,
    height: windowHeight * 0.08,
    width: windowWidth * 0.7,
  },
  spotifyLogo: {
    height: windowWidth * 0.05,
    width: windowWidth * 0.05,
    resizeMode: "contain",
  },
  synth_container: {
    backgroundColor: "#C6B6DD",
    height: windowWidth * 0.3,
    width: windowWidth * 0.6,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: windowWidth * 0.15,
    borderRadius: 20,
  },
  synth_text: {
    fontFamily: "",
  },
});
