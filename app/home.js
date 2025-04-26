import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";

export default function home() {
  const navigation = useNavigation();
  navigation.setOptions({
    headerLeft: () => (
      <TouchableOpacity
        onPress={() => {
          alert("implement logout");
        }}
      >
        <Ionicons name="menu" size={32} color="white" />
      </TouchableOpacity>
    ),
  });
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.cardContainer}>
        <TouchableOpacity style={styles.card}>
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
    paddingTop: 40,
  },
  title: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  cardContainer: {
    padding: 20,
    gap: 20,
  },
  card: {
    backgroundColor: "#000000",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
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
