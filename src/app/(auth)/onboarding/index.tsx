import { useRouter } from "expo-router";
import { cssInterop } from "nativewind";
import { Pressable, Text, View } from "react-native";

import LogoSvg from '@/assets/images/appLogo.svg';

const Logo = cssInterop(LogoSvg, {
    className: {
        target: "style",
        nativeStyleToProp: { fill: true },
    },
});

export default function OnboardingScreen() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-bg-main">
            <View className="flex-1 justify-end px-screen-x pb-9">
                {/* Logo ring */}
                <View className="flex-1 items-center justify-center">
                    <Logo width={250} height={250} className="text-primary" />
                </View>

                {/* Headline + subcopy */}
                <View className="items-center mb-8">
                    <Text className="text-display font-extrabold text-text-white text-center leading-9 tracking-tight">
                        Your Vault,{"\n"}Your Face,{"\n"}Your Privacy
                    </Text>
                    <Text className="font-sans text-body-sm text-text-muted text-center mt-3 leading-5">
                        Files locked behind facial recognition —{"\n"}no one gets in but you.
                    </Text>
                </View>

                {/* Primary CTA */}
                <Pressable
                    className="w-full py-4 rounded-md bg-primary items-center justify-center active:bg-primary-hover"
                >
                    <Text className="font-sans text-2xl font-bold text-bg-dark">
                        Get Started
                    </Text>
                </Pressable>

                {/* Secondary link */}
                <Pressable
                    className="m-3 items-center py-2"
                    hitSlop={8}
                >
                    <Text className="font-sans text-caption text-text-disabled text-center">
                        Already have an account?{" "}
                        <Text className="text-primary text-2xl font-bold">Log in</Text>
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}