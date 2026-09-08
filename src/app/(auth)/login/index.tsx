import Ionicons from "@react-native-vector-icons/ionicons";
import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
    // const { unlockWithBiometrics } = useVaultLock();
    const insets = useSafeAreaInsets();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    // const [biometricStatus, setBiometricStatus] = useState<string | null>(null);

    // TODO: wire to Clerk's useSignIn() — this currently just simulates a
    // network call so the UI/loading state can be exercised end-to-end.
    const handleLogin = async () => {
        setIsSubmitting(true);
        console.log("[LoginScreen] handleLogin stub — email:", email);
        await new Promise((resolve) => setTimeout(resolve, 600));
        setIsSubmitting(false);
    };

    // TODO: wire to Clerk's OAuth flow (startOAuthFlow with Google strategy)
    const handleGoogleAuth = () => {
        console.log("[LoginScreen] handleGoogleAuth stub");
    };

    // Real: biometric-only prompt via the existing vault lock context.
    // const handleFaceId = async () => {
    //     setBiometricStatus(null);
    //     const outcome = await unlockWithBiometrics(true);
    //     console.log("[LoginScreen] Face ID outcome:", JSON.stringify(outcome));
    //     if (outcome.status !== "success") {
    //         setBiometricStatus(
    //             outcome.status === "unavailable"
    //                 ? "Face ID isn't set up on this device."
    //                 : "Face ID didn't match. Try again."
    //         );
    //     }
    // };

    // Real: allows fallthrough to the device passcode UI.
    // const handleDevicePasscode = async () => {
    //     setBiometricStatus(null);
    //     const outcome = await unlockWithBiometrics(false);
    //     console.log("[LoginScreen] Passcode outcome:", JSON.stringify(outcome));
    //     if (outcome.status !== "success") {
    //         setBiometricStatus(
    //             outcome.status === "unavailable"
    //                 ? "No device passcode is set up."
    //                 : "Passcode entry was cancelled."
    //         );
    //     }
    // };

    // TODO: route to /(auth)/create-account once that screen exists
    const handleCreateAccount = () => {
        console.log("[LoginScreen] navigate to create account — not yet implemented");
    };

    // TODO: route to /(auth)/recover-account once that screen exists
    const handleRecoverAccount = () => {
        console.log("[LoginScreen] navigate to recover account — not yet implemented");
    };

    return (
        <View
            className="flex-1 bg-bg-main"
            style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
            <View className="flex-1 px-screen-x pt-4">
                <View className="items-center mb-2">
                    <View className="w-16 h-16 rounded-xl bg-surface-selected-light border border-border-default items-center justify-center mb-4">
                        <Ionicons name="lock-closed" size={28} color="#5FAEF7" />
                    </View>
                    <Text className="text-text-white text-heading-md font-bold font-sans">
                        Welcome back
                    </Text>
                    <Text className="text-text-muted text-body-sm font-sans mt-1">
                        Unlock Vaultface to continue
                    </Text>
                </View>

                <View className="mt-6">
                    <Text className="text-text-secondary text-caption font-semibold font-sans mb-1.5">
                        Email
                    </Text>
                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        placeholderTextColor="#60748D"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        className="w-full bg-surface-default border border-border-default rounded-md px-4 py-3.5 text-text-primary text-body font-sans mb-3"
                    />

                    <Text className="text-text-secondary text-caption font-semibold font-sans mb-1.5">
                        Password
                    </Text>
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="••••••••"
                        placeholderTextColor="#60748D"
                        secureTextEntry
                        className="w-full bg-surface-default border border-border-default rounded-md px-4 py-3.5 text-text-primary text-body font-sans mb-2"
                    />

                    <Pressable className="self-end mb-4">
                        <Text className="text-primary text-caption font-semibold font-sans">
                            Forgot password?
                        </Text>
                    </Pressable>

                    <Pressable
                        onPress={handleLogin}
                        disabled={isSubmitting}
                        className="w-full bg-primary rounded-md py-4 items-center justify-center active:bg-primary-hover disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#04101f" />
                        ) : (
                            <Text className="text-bg-dark text-body font-bold font-sans">
                                Log In
                            </Text>
                        )}
                    </Pressable>
                </View>

                <View className="flex-row items-center gap-3 my-5">
                    <View className="flex-1 h-px bg-border-default" />
                    <Text className="text-text-disabled text-caption font-sans">
                        or unlock with
                    </Text>
                    <View className="flex-1 h-px bg-border-default" />
                </View>

                <View className="flex-row gap-3">
                    <Pressable
                        // onPress={handleFaceId}
                        className="flex-1 flex-row items-center justify-center gap-2 bg-surface-default border border-border-default rounded-md py-3.5 active:bg-surface-raised"
                    >
                        <Ionicons name="scan-outline" size={18} color="#F3F6F9" />
                        <Text className="text-text-primary text-body-sm font-semibold font-sans">
                            Face ID
                        </Text>
                    </Pressable>
                    <Pressable
                        // onPress={handleDevicePasscode}
                        className="flex-1 flex-row items-center justify-center gap-2 bg-surface-default border border-border-default rounded-md py-3.5 active:bg-surface-raised"
                    >
                        <Ionicons name="keypad-outline" size={18} color="#F3F6F9" />
                        <Text className="text-text-primary text-body-sm font-semibold font-sans">
                            PIN
                        </Text>
                    </Pressable>
                </View>

                {
                // biometricStatus && 
                (
                    <Text className="text-text-muted text-caption font-sans text-center mt-3">
                        {/* {biometricStatus} */}
                    </Text>
                )}

                <View className="flex-row items-center gap-3 my-5">
                    <View className="flex-1 h-px bg-border-default" />
                    <Text className="text-text-disabled text-caption font-sans">
                        or continue with
                    </Text>
                    <View className="flex-1 h-px bg-border-default" />
                </View>

                <Pressable
                    onPress={handleGoogleAuth}
                    className="w-full flex-row items-center justify-center gap-2 bg-surface-default border border-border-default rounded-md py-3.5 active:bg-surface-raised"
                >
                    <Ionicons name="logo-google" size={16} color="#F3F6F9" />
                    <Text className="text-text-primary text-body-sm font-semibold font-sans">
                        Continue with Google
                    </Text>
                </Pressable>

                <View className="flex-row justify-center flex-wrap gap-x-1.5 mt-6">
                    <Text className="text-text-disabled text-caption font-sans">
                        Don&apos;t have an account?
                    </Text>
                    <Pressable 
                    // onPress={handleCreateAccount}
                    >
                        <Text className="text-primary text-caption font-semibold font-sans">
                            Create one
                        </Text>
                    </Pressable>
                    <Text className="text-text-disabled text-caption font-sans">·</Text>
                    <Pressable 
                    // onPress={handleRecoverAccount}
                    >
                        <Text className="text-primary text-caption font-semibold font-sans">
                            Recover account
                        </Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}
