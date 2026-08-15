import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-bg-main">
      <Text className="text-xl font-bold text-text-primary">
        Welcome to Nativewind!
      </Text>
      
      <Link href="/(auth)/sign-in" className="mt-4 rounded bg-primary text-white">Go To SignIn</Link>
      <Link href="/(auth)/sign-up" className="mt-4 rounded bg-primary text-white">Go To SignUp</Link>
    </View>
  );
}