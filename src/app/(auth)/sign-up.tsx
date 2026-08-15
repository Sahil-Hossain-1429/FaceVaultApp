import { Link } from 'expo-router'
import { Text, View } from 'react-native'


const SignUp = () => {
    return (
        <View>
            <Text>SignUp</Text>
            <Link href="/(auth)/sign-in">Sign UP</Link>
        </View>
    )
}

export default SignUp