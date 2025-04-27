import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal,
  Pressable,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";
// import { ScrollPicker } from ".../ScrollPicker.js";

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

export default function home() {
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);

  // Move navigation.setOptions to a useEffect hook
  useEffect(() => {
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
  }, [navigation]); // Only re-run if navigation changes

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.cardContainer}>
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => {
            Alert.alert("Modal has been closed.");
            setModalVisible(!modalVisible);
          }}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <Text style={styles.modalText}>Hello World!</Text>
              {/* <ScrollPicker /> */}
              <Pressable
                style={[styles.button, styles.buttonClose]}
                onPress={() => setModalVisible(!modalVisible)}
              >
                <Text style={styles.textStyle}>Hide Modal</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <TouchableOpacity
          style={styles.card}
          onPress={() => setModalVisible(true)}
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
  modalView: {
    margin: 20,
    marginTop: windowHeight * 0.3,
    backgroundColor: "white",
    borderRadius: 10,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
  },
});
