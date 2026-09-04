import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function Home() {
    return (
        <View style={styles.container}>
            <Link href="/onboarding">Get Started Screen</Link>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});