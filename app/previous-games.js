import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Pressable,
  Image,
  ScrollView,
} from "react-native";
import { useNavigation } from "expo-router";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

export default function PreviousGames() {
    const navigation = useNavigation();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);

    // Set header options
    useEffect(() => {
        navigation.setOptions({
            header: (props) => (
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.menuButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={28} color="white" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>Previous Games</Text>
                    </View>
                    <View style={[styles.placeholder, { width: 44 }]} />
                </View>
            ),
        });
    }, [navigation]);

    useEffect(() => {
        const fetchGames = async () => {
            try {
                // Debug: Log all AsyncStorage keys
                const allKeys = await AsyncStorage.getAllKeys();
                console.log("All AsyncStorage keys:", allKeys);

                // Try both possible keys
                const gameHistory = await AsyncStorage.getItem("gameHistory");
                const playedGameIds = await AsyncStorage.getItem("playedGameIds");
                console.log("gameHistory:", gameHistory);
                console.log("playedGameIds:", playedGameIds);

                // Use whichever key has data
                const gameIds = gameHistory || playedGameIds;
                if (!gameIds) {
                    console.log("No game IDs found in AsyncStorage");
                    setGames([]);
                    return;
                }

                const gameIdsArray = JSON.parse(gameIds);
                console.log("Parsed game IDs:", gameIdsArray);
                
                const uniqueGameIds = [...new Set(gameIdsArray)]; // Deduplicate game IDs
                console.log("Unique game IDs:", uniqueGameIds);
                
                const gamesData = await Promise.all(
                    uniqueGameIds.map(async (gameId) => {
                        try {
                            console.log("Fetching game:", gameId);
                            const response = await fetch(
                                `https://synth-69a11b47cbf3.herokuapp.com/prev_game?gameId=${gameId}`
                            );
                            if (!response.ok) {
                                console.error(`Failed to fetch game ${gameId}:`, response.status);
                                return null;
                            }
                            const data = await response.json();
                            console.log("Game data received:", gameId, data);
                            if (!data.game) {
                                console.log("No game data in response for:", gameId);
                                return null;
                            }
                            return {
                                ...data.game,
                                gameId: gameId
                            };
                        } catch (error) {
                            console.error(`Error fetching game ${gameId}:`, error);
                            return null;
                        }
                    })
                );

                // Filter out null values and sort by date
                const validGames = gamesData
                    .filter((game) => game !== null)
                    .sort((a, b) => {
                        const dateA = new Date(a.metadata?.createdAt || 0);
                        const dateB = new Date(b.metadata?.createdAt || 0);
                        return dateB - dateA;
                    });

                console.log("Final valid games:", validGames);
                setGames(validGames);
            } catch (error) {
                console.error("Error in fetchGames:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchGames();
    }, []);

    // Deduplicate by createdAt if available, otherwise fallback to gameId
    const uniqueGamesMap = {};
    games.forEach(game => {
        const key = game.metadata?.createdAt || game.gameId;
        if (key && !uniqueGamesMap[key]) {
            uniqueGamesMap[key] = game;
        }
    });
    const uniqueGames = Object.values(uniqueGamesMap);

    const filteredGames = uniqueGames.filter((game) =>
        game.metadata?.game_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search games..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#888"
                />
            </View>
            {loading ? (
                <Text style={styles.loadingText}>Loading games...</Text>
            ) : filteredGames.length === 0 ? (
                <Text style={styles.noGamesText}>
                    {searchQuery ? "No games found" : "No previous games"}
                </Text>
            ) : (
                <ScrollView contentContainerStyle={styles.gamesList}>
                    {filteredGames.map((game) => {
                        // Get the first song from guess_tracks as representative
                        const firstSong = game.game_data?.guess_tracks?.[0]?.track;
                        return (
                            <Pressable
                                key={game.gameId}
                                style={styles.gameItem}
                                onPress={() => router.push(`/game-details?gameId=${game.gameId}`)}
                            >
                                <Image
                                    source={{
                                        uri: firstSong?.imageUrl || "https://via.placeholder.com/60",
                                    }}
                                    style={styles.gameImage}
                                />
                                <View style={styles.gameInfo}>
                                    <Text style={styles.gameName}>{game.metadata?.game_name || "Untitled Game"}</Text>
                                    <Text style={styles.gameDetails}>
                                        {game.metadata?.players?.map((p) => p.username).join(", ") || "No players"}
                                    </Text>
                                    <Text style={styles.gameDate}>
                                        {new Date(game.metadata?.createdAt || Date.now()).toLocaleDateString()}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={24} color="#666" />
                            </Pressable>
                        );
                    })}
                </ScrollView>
            )}
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
        backgroundColor: "#8E44AD",
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
        width: 44,
        height: 44,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1,
    },
    headerTitleContainer: {
        position: "absolute",
        left: 0,
        right: 0,
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 10
    },
    headerTitle: {
        color: "white",
        fontSize: 24,
        fontWeight: "bold",
        textAlign: "center",
    },
    placeholder: {
        width: 44,
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#2A2A2A",
        margin: 15,
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#444",
    },
    searchIcon: {
        marginRight: 10,
        color: "#666",
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: "white",
    },
    loadingText: {
        fontSize: 16,
        textAlign: "center",
        marginTop: 20,
        color: "#CCC",
    },
    noGamesText: {
        fontSize: 16,
        textAlign: "center",
        marginTop: 20,
        color: "#CCC",
    },
    gamesList: {
        padding: 15,
    },
    gameItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#2A2A2A",
        borderRadius: 12,
        padding: 15,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#444",
    },
    gameImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 15,
    },
    gameInfo: {
        flex: 1,
    },
    gameName: {
        fontSize: 16,
        fontWeight: "500",
        color: "white",
        marginBottom: 4,
    },
    gameDetails: {
        fontSize: 14,
        color: "#CCC",
        marginBottom: 2,
    },
    gameDate: {
        fontSize: 12,
        color: "#999",
    },
});