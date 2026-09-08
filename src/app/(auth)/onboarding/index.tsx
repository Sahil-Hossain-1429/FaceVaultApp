import { useRouter } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";

export default function OnboardingScreen() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-bg-main">
            {/* Logo ring */}
            <View className="items-center justify-center mt-30">
                <Image
                    source={require("@/assets/images/appLogo.png")}
                    className="w-100 h-100"
                    resizeMode="contain"
                />
            </View>
            <View className="flex-1 justify-end px-screen-x pb-9">
                {/* Headline + subcopy */}
                <View className="items-center mb-8">
                    <Text className="text-display font-semibold text-text-white text-center leading-8 tracking-tight">
                        Your Vault,{"\n"}Your Face,{"\n"}Your Privacy
                    </Text>
                    <Text className="font-sans text-body-sm text-text-muted text-center mt-3">
                        Files locked behind facial recognition .
                    </Text>
                </View>

                {/* Primary CTA */}
                <Pressable
                    onPress={() => router.push("/(auth)/SignUp")}
                    className="w-full py-4 rounded-md bg-primary items-center justify-center active:bg-primary-hover"
                >
                    <Text className="font-sans text-2xl font-bold text-bg-dark">
                        Get Started
                    </Text>
                </Pressable>

                {/* Secondary link */}

                <Pressable
                    onPress={() => router.push("/login")}
                    className="w-full py-4 rounded-md items-center justify-center mb-2"
                >
                    <Text className="font-sans text-text-disabled text-center leading-6">
                        Already have an account?{" "}
                        <Text className="text-primary font-bold ">Log in</Text>
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}