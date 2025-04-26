import {Text, View, Image, StyleSheet, Dimensions, ImageBackground} from 'react-native';

// import { Themes } from './assets/Themes';
import { millisToMinutesAndSeconds } from './utils'; 
import { BlurView } from 'expo-blur';
import { colors } from './assets/colors';

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

const Song = (props) => {

    const { listIndex, imageUrl, songTitle, songArtists, albumName, duration } = props;
    const artistNames = songArtists.map(artist => artist.name).join(", ");

    return (
        <BlurView style={styles.container} blurType='light' intensity={24}>
            <View style={styles.indexContainer}>
                <Text style={styles.text}>{listIndex}</Text>
            </View>
            <Image
                style={styles.albumCover}
                source={{uri: imageUrl}}
            />
            <View style={styles.artistContainer}>
                <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{songTitle}</Text>
                <Text style={styles.text}>{artistNames}</Text>
            </View>
            <View style={styles.albumContainer}>
                <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{albumName}</Text>
            </View>
            <View style={styles.durationContainer}>
                <Text style={styles.text}>{millisToMinutesAndSeconds(duration)}</Text>
            </View>
        </BlurView>
    );
};

export default Song;

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        width: windowWidth - 20,
        marginLeft: 10,
        gap: 5,
        paddingVertical: 18,
        borderColor: 'transparent',
        marginBottom: 8,
        marginTop: 7,
        borderWidth: 3,
        borderRadius: 55,
        overflow: 'hidden',
        justifyContent: 'center'
    },
    indexContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        flex: 0.5
    },
    albumContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1
    },
    durationContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingRight: 10,
        flex: 0.5
    },
    text: {
        color: colors.gray,
        fontSize: 12,
        fontFamily: 'ZenDots'
    },
    artistContainer: {
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 2
    },
    title :{
        color: colors.white,
        fontSize: 13,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'ZenDots'
    },
    albumCover: {
        width: 40,
        heght: 40
    }
});