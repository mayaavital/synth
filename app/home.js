import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useEffect } from "react";

export default function home() {
  const navigation = useNavigation();
  const router = useRouter();
  
  // Hide default header and use our custom one
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Custom header matching create-game.js */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => {
            alert("implement logout");
          }}
        >
          <Ionicons name="menu" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.logoText}>SYNTH</Text>
        <View style={styles.placeholder} />
      </View>
      
      <View style={styles.cardContainer}>
        <TouchableOpacity 
          style={styles.card}
          onPress={() => router.push("/create-game")}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="add-circle" size={32} color="white" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.cardTitle}>Create a new game</Text>
            <Text style={styles.cardSubtitle}>
              Invite your friends, guess the listener, and create playlists.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="people" size={32} color="white" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.cardTitle}>Join a game</Text>
            <Text style={styles.cardSubtitle}>
              Join a game that your friend already created.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="play-back-circle-outline" size={32} color="white" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.cardTitle}>Previous Games</Text>
            <Text style={styles.cardSubtitle}>
              See how you and your friends did on previous games.
            </Text>
          </View>
        </TouchableOpacity>
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
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#8E44AD", // Purple background for header
    paddingVertical: 15,
    paddingHorizontal: 16,
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
  title: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  cardContainer: {
    padding: 20,
    gap: 20,
    paddingTop: 30,
  },
  card: {
    backgroundColor: "#000000",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    shadowColor: "#C6B6DD", // light purple (#c084fc is Tailwind's purple-400)
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  iconContainer: {
    backgroundColor: "#523676",
    borderRadius: 16,
    padding: 10,
    marginRight: 20,
    marginLeft: 10,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  cardSubtitle: {
    color: "#d1d5db",
    marginTop: 4,
    fontSize: 14,
  },
});
