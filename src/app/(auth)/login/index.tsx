import { useSignIn, useSSO } from "@clerk/expo";
import Ionicons from "@react-native-vector-icons/ionicons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Eye, EyeOff } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Required once at module scope for useSSO() to correctly close the
// in-app browser and return control to the app after the OAuth redirect.
WebBrowser.maybeCompleteAuthSession();

// Warms up the Android browser process so the SSO popup opens faster.
const useWarmUpBrowser = () => {
    useEffect(() => {
        void WebBrowser.warmUpAsync();
        return () => {
            void WebBrowser.coolDownAsync();
        };
    }, []);
};

export default function LoginScreen() {
    useWarmUpBrowser();
    const insets = useSafeAreaInsets();

    const { signIn, errors } = useSignIn();
    const { startSSOFlow } = useSSO();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const handleLogin = useCallback(async () => {
        setFormError(null);
        setIsSubmitting(true);
        try {
            const createResult = await signIn.create({ identifier: email });
            if (createResult?.error) {
                setFormError(createResult.error.message ?? "Couldn't find that account.");
                return;
            }

            const passwordResult = await signIn.password({ password });
            if (passwordResult?.error) {
                return;
            }

            if (signIn.status === "complete") {
                await signIn.finalize({
                    navigate: () => router.replace("/(tabs)"),
                });
            }
            //  else {
            //     // Any status other than "complete" here means Clerk wants
            //     // another step (e.g. MFA, Device Trust) that this screen
            //     // doesn't handle yet.
            //     setFormError("Additional verification required.");
            // }
        } catch (err) {
            console.error("[LoginScreen] handleLogin error:", err);
            setFormError("Something went wrong. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }, [signIn, email, password]);

    const handleGoogleAuth = useCallback(async () => {
        setFormError(null);
        setIsGoogleSubmitting(true);
        try {
            const { createdSessionId, setActive } = await startSSOFlow({
                strategy: "oauth_google",
            });

            if (createdSessionId && setActive) {
                await setActive({ session: createdSessionId });
                router.replace("/(tabs)");
            }
            // If createdSessionId is undefined, the user needs to complete
            // additional steps (e.g. account transfer) — not handled here.
        } catch (err) {
            console.error("[LoginScreen] handleGoogleAuth error:", err);
            setFormError("Google sign-in failed. Please try again.");
        } finally {
            setIsGoogleSubmitting(false);
        }
    }, [startSSOFlow]);

    const [showPassword, setShowPassword] = useState(false);

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
                    {errors?.fields?.identifier?.message ? (
                        <Text className="text-danger text-caption font-sans mb-2 -mt-2">
                            {errors.fields.identifier.message}
                        </Text>
                    ) : null}

                    <Text className="text-text-secondary text-caption font-semibold font-sans mb-1.5">
                        Password
                    </Text>
                    <View className="w-full flex-row items-center bg-surface-default border border-border-default rounded-md">
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            placeholder="••••••••"
                            placeholderTextColor="#60748D"
                            secureTextEntry={!showPassword}
                            className="flex-1 px-4 py-3.5 text-text-primary text-body font-sans"
                        />
                        <TouchableOpacity
                            onPress={() => setShowPassword((prev) => !prev)}
                            className="px-3"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            {showPassword ? (
                                <EyeOff size={20} color="#60748D" />
                            ) : (
                                <Eye size={20} color="#60748D" />
                            )}
                        </TouchableOpacity>
                    </View>
                    {errors?.fields?.password?.message ? (
                        <Text className="text-danger text-caption font-sans mt-1.5">
                            {errors.fields.password.message}
                        </Text>
                    ) : null}

                    {formError ? (
                        <Text className="text-danger text-caption font-sans mt-3 text-center">
                            {formError}
                        </Text>
                    ) : null}

                    <Pressable className="my-6"
                        onPress={() => console.log("Forgot Password Press")}
                    >
                        <Text className="text-balance text-primary font-semibold">
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
                    disabled={isGoogleSubmitting}
                    className="w-full flex-row items-center justify-center gap-2 bg-surface-default border border-border-default rounded-md py-3.5 active:bg-surface-raised disabled:opacity-50"
                >
                    {isGoogleSubmitting ? (
                        <ActivityIndicator color="#F3F6F9" />
                    ) : (
                        <>
                            <Ionicons name="logo-google" size={16} color="#F3F6F9" />
                            <Text className="text-text-primary text-body-sm font-semibold font-sans">
                                Continue with Google
                            </Text>
                        </>
                    )}
                </Pressable>

                <View className="flex-row justify-center flex-wrap gap-x-1.5 mt-6">
                    <Text className="text-text-disabled text-caption font-sans">
                        Don&apos;t have an account?
                    </Text>
                    <Pressable
                        onPress={() => router.push("/SignUp")}
                    >
                        <Text className="text-primary text-caption font-semibold font-sans">
                            Create one
                        </Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}