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
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function PreviousGames() {
    const navigation = useNavigation();
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [games, setGames] = useState([]);

    useEffect(() => {
        const fetchGames = async () => {
            try {
                const storedGames = await AsyncStorage.getItem("playedGameIds");
                if (storedGames) {
                    const gamesArray = JSON.parse(storedGames);
                    const updatedGames = await Promise.all(
                        gamesArray.map(async (gameId) => {
                            const response = await fetch(`http://10.29.71.225:3000/prev_game?gameId=${gameId}`);
                            console.log("response", response);
                            if (!response.ok) {
                                console.log("Failed to fetch game data:", response.statusText);
                                return null; // Skip this game if the fetch fails
                            }
                            const data = await response.json();

                            // Defensive: handle missing or error data
                            if (!data.game || !data.game.metadata) return null;

                            return {
                                id: data.game.id || gameId,
                                name: data.game.metadata.game_name || "Untitled Game",
                                creator: data.game.metadata.creator || "Unknown",
                                date: data.game.metadata.date || "", // Add this if you have a date field
                                image: data.image || "", // Or set a default image if needed
                                raw: data, // Keep the raw data if you want to use more fields later
                            };
                        })
                    );
                    // Remove nulls (failed fetches)
                    setGames(updatedGames.filter(Boolean));
                }
                console.log("storedGames", storedGames);
            } catch (error) {
                console.log("Failed to load previous games:", error);
            }
        };
        fetchGames();
    }, []);

    const filteredGames = games.filter((game) =>
        game.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={28} color="#222" />
                </Pressable>
                <Text style={styles.headerTitle}>Previous Games</Text>
                <View style={{ width: 28 }} />
            </View>
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#888" style={{ marginRight: 8 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search games"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>
            <View style={styles.listContainer}>
                {filteredGames.length === 0 ? (
                    <Text style={styles.emptyText}>No previous games found.</Text>
                ) : (
                    filteredGames.map((game) => (
                        <TouchableOpacity
                            key={game.id}
                            style={styles.gameItem}
                            onPress={() => router.push(`/game/${game.id}`)}
                        >
                            <Image source={{ uri: game.image }} style={styles.gameImage} />
                            <View style={styles.gameInfo}>
                                <Text style={styles.gameTitle}>{game.name}</Text>
                                <Text style={styles.gameDate}>Creator: {game.creator}</Text>
                                {/* Optionally show date: <Text style={styles.gameDate}>{game.date}</Text> */}
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#888" />
                        </TouchableOpacity>
                    ))
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 18,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#222",
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f2f2f2",
        borderRadius: 10,
        paddingHorizontal: 12,
        marginBottom: 18,
        height: 44,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: "#222",
    },
    listContainer: {
        flex: 1,
    },
    gameItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f9f9f9",
        borderRadius: 10,
        padding: 12,
        marginBottom: 14,
    },
    gameImage: {
        width: 56,
        height: 56,
        borderRadius: 8,
        marginRight: 14,
        backgroundColor: "#e0e0e0",
    },
    gameInfo: {
        flex: 1,
    },
    gameTitle: {
        fontSize: 17,
        fontWeight: "600",
        color: "#222",
    },
    gameDate: {
        fontSize: 14,
        color: "#888",
        marginTop: 2,
    },
    emptyText: {
        textAlign: "center",
        color: "#aaa",
        marginTop: 40,
        fontSize: 16,
    },
});