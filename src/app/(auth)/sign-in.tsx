import { Link } from 'expo-router'
import { Text, View } from 'react-native'

const signin = () => {
    return (
        <View>
            <Text>signin</Text>
            <Link href="/(auth)/sign-up">Create Account</Link>
        </View>
    )
}

export default signin