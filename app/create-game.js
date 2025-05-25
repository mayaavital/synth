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

export default function CreateGame() {
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
          <View style={styles.headerTitleContainer}>
            <Image 
              source={require("../assets/SYNTH.png")} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
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

        <Text style={styles.sectionTitle}>Player Count</Text>
        <View style={styles.playerCountContainer}>
          <TouchableOpacity
            style={[
              styles.countOption,
              playerCount === 2 && styles.selectedCount,
            ]}
            onPress={() => setPlayerCount(2)}
          >
            <Text style={styles.countText}>2</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.countOption,
              playerCount === 3 && styles.selectedCount,
            ]}
            onPress={() => setPlayerCount(3)}
          >
            <Text style={styles.countText}>3</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.countOption,
              playerCount === 4 && styles.selectedCount,
            ]}
            onPress={() => setPlayerCount(4)}
          >
            <Text style={styles.countText}>4</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.playerCountContainer}>
          <TouchableOpacity
            style={[
              styles.countOption,
              playerCount === 5 && styles.selectedCount,
            ]}
            onPress={() => setPlayerCount(5)}
          >
            <Text style={styles.countText}>5</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.countOption,
              playerCount === 6 && styles.selectedCount,
            ]}
            onPress={() => setPlayerCount(6)}
          >
            <Text style={styles.countText}>6</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.countOption,
              playerCount === 7 && styles.selectedCount,
            ]}
            onPress={() => setPlayerCount(7)}
          >
            <Text style={styles.countText}>7</Text>
          </TouchableOpacity>
        </View>

        <Pressable
          style={[
            styles.createButton,
            !gameName && styles.createButtonDisabled,
          ]}
          onPress={() => {
            if (!gameName.trim()) {
              alert("Please enter a game name");
              return;
            }

            // Here you would typically send this data to your backend
            console.log("Creating game:", { gameName, playerCount });

            // Navigate to the game lobby with game details
            router.push({
              pathname: "/game-lobby",
              params: { gameName, playerCount },
            });
          }}
        >
          <Text style={styles.createButtonText}>CREATE GAME</Text>
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
  // menuButton: {
  //   padding: 8,
  // },
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
  playerCountContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 40,
  },
  countOption: {
    width: "30%",
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#333",
    alignItems: "center",
  },
  selectedCount: {
    borderBottomColor: "#8E44AD",
  },
  countText: {
    color: "white",
    fontSize: 32,
  },
  createButton: {
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
  createButtonDisabled: {
    backgroundColor: "#888",
    opacity: 0.7,
  },
  createButtonText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
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
  headerTitleContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    bottom: 5,
  },
  logoImage: {
    height: 35,
    width: 110,
  },
});
