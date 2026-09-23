import { Stack } from "expo-router";

export default function AuthLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="onboarding/index" />
            <Stack.Screen name="SignUp/index" />
            <Stack.Screen name="login/index" />
        </Stack>
    );
}