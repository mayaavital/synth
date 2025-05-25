import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Pressable,
  Image,
} from "react-native";
import { useState, useEffect } from "react";
import { useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function JoinGame() {
  const navigation = useNavigation();
  const router = useRouter();
  const [gameName, setGameName] = useState("");
  const [playerCount, setPlayerCount] = useState(2);

  // Set header options
  useEffect(() => {
    navigation.setOptions({
      // headerShown: true,
      // headerTitleStyle: {
      //   color: "#FFC857", // Golden yellow color
      //   fontSize: 28,
      //   fontWeight: "bold",
      //   letterSpacing: 2,
      // },
      // headerStyle: { backgroundColor: "#8E44AD", height: 60 + insets.top},
      // headerLeft: () => (
      //   <TouchableOpacity
      //     style={styles.menuButton}
      //     onPress={() => navigation.goBack()}
      //   >
      //     <Ionicons name="arrow-back" size={28} color="white" />
      //   </TouchableOpacity>
      // ),
      // title: "SYNTH",
      header: (props) => (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.logoText}>SYNTH</Text>
          <View style={styles.placeholder} />
        </View>
      ),
    });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      {/* <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.logoText}>SYNTH</Text>
        <View style={styles.placeholder} />
      </View> */}

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Game Name</Text>
        <TextInput
          style={styles.input}
          value={gameName}
          onChangeText={setGameName}
          placeholder="Enter game name"
          placeholderTextColor="#888"
        />

        <Pressable
          style={[styles.joinButton, !gameName && styles.joinButtonDisabled]}
          onPress={() => {
            if (!gameName.trim()) {
              alert("Please enter a game name");
              return;
            }

            // Here you would typically send this data to your backend
            //fetch game from backend - if no game return error message
            console.log("Joining Game:", { gameName });

            // Navigate to the game lobby with game details
            //player count hard coded here but would get from the backend
            router.push({
              pathname: "/game-lobby",
              params: { gameName, playerCount },
            });
          }}
        >
          <Text style={styles.joinButtonText}>Join Game</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: "#8E44AD", // Purple background for header
    paddingVertical: 5,
    paddingHorizontal: 16,
    height: 80,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 7,
    elevation: 5,
  },
  menuButton: {
    padding: 8,
  },
  logoText: {
    color: "#FFC857", // Golden yellow color
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  placeholder: {
    width: 44, // Same width as menu button for balanced layout
  },
  content: {
    flex: 1,
    padding: 24,
  },
  sectionTitle: {
    color: "white",
    fontSize: 32,
    fontWeight: "bold",
    marginTop: 24,
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#2A2A2A",
    borderBottomWidth: 2,
    borderBottomColor: "#8E44AD",
    color: "white",
    fontSize: 20,
    padding: 12,
    marginBottom: 24,
  },
  selectedCount: {
    borderBottomColor: "#00A9FF",
  },
  countText: {
    color: "white",
    fontSize: 32,
  },
  joinButton: {
    backgroundColor: "#8E44AD",
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    marginTop: "auto",
    marginBottom: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 7,
    elevation: 5,
  },
  joinButtonDisabled: {
    backgroundColor: "#888",
    opacity: 0.7,
  },
  joinButtonText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
});
