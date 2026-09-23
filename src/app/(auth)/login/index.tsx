import { useAuth, useSignIn, useSSO } from "@clerk/expo";
import Ionicons from "@react-native-vector-icons/ionicons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Eye, EyeOff } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
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

function ComingSoonDialog({
    visible,
    onClose,
}: {
    visible: boolean;
    onClose: () => void;
}) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.dialogOverlay}>
                <View style={styles.dialog}>
                    <View style={styles.dialogIconWrap}>
                        <Text style={styles.dialogIconText}>✨</Text>
                    </View>

                    <Text style={styles.dialogTitle}>Stay Tuned</Text>

                    <Text style={styles.dialogBody}>
                        Stay Tuned for the upcoming updates
                    </Text>

                    <TouchableOpacity
                        style={[styles.dialogBtn, styles.dialogBtnCancel]}
                        onPress={onClose}
                    >
                        <Text style={styles.dialogBtnCancelText}>Okay</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

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

    const [showPassword, setShowPassword] = useState(false);

    const [showComingSoonDialog, setShowComingSoonDialog] = useState(false);

    const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();

    /**
     * Email/password login
     *
     * Clerk Core 3:
     * 1. signIn.password()
     * 2. Check signIn.status
     * 3. signIn.finalize()
     * 4. Navigate to the authenticated tabs
     */
    const handleLogin = useCallback(async () => {
        setFormError(null);

        if (!email.trim()) {
            setFormError("Please enter your email.");
            return;
        }

        if (!password) {
            setFormError("Please enter your password.");
            return;
        }

        if (!isAuthLoaded) {
            setFormError("Authentication is still loading. Please try again.");
            return;
        }

        // If Clerk already has an active session,
        // there is no reason to start another sign-in attempt.
        if (isSignedIn) {
            router.replace("/(tabs)");
            return;
        }

        setIsSubmitting(true);

        try {
            const { error } = await signIn.password({
                emailAddress: email.trim(),
                password,
            });

            if (error) {
                console.error(
                    "[LoginScreen] Clerk sign-in error:",
                    error
                );

                setFormError(
                    error.message ?? "Invalid email or password."
                );

                return;
            }

            if (signIn.status === "complete") {
                await signIn.finalize({
                    navigate: () => {
                        router.replace("/(tabs)");
                    },
                });

                return;
            }

            if (signIn.status === "needs_second_factor") {
                setFormError(
                    "Additional verification is required."
                );

                return;
            }

            if (signIn.status === "needs_client_trust") {
                setFormError(
                    "This device requires additional verification."
                );

                return;
            }

            setFormError(
                "Additional verification is required to complete sign in."
            );
        } catch (err) {
            console.error(
                "[LoginScreen] handleLogin error:",
                err
            );

            setFormError(
                "Something went wrong. Please try again."
            );
        } finally {
            setIsSubmitting(false);
        }
    }, [
        signIn,
        email,
        password,
        isAuthLoaded,
        isSignedIn,
    ]);

    /**
     * Face ID button
     *
     * Navigates to:
     * src/app/face-verification.tsx
     */
    const handleFaceId = useCallback(() => {
        setFormError(null);
        router.push("/face-verification");
    }, []);

    /**
     * PIN button
     *
     * PIN authentication is not implemented yet,
     * so show the Coming Soon dialog.
     */
    const handleDevicePasscode = useCallback(() => {
        setShowComingSoonDialog(true);
    }, []);

    /**
     * Google authentication
     *
     * useSSO() is still appropriate for browser-based OAuth.
     */
    const handleGoogleAuth = useCallback(async () => {
        setFormError(null);
        setIsGoogleSubmitting(true);

        try {
            const { createdSessionId, setActive } =
                await startSSOFlow({
                    strategy: "oauth_google",
                });

            if (createdSessionId && setActive) {
                await setActive({
                    session: createdSessionId,
                });

                router.replace("/(tabs)");
            }
        } catch (err) {
            console.error(
                "[LoginScreen] handleGoogleAuth error:",
                err
            );

            setFormError(
                "Google sign-in failed. Please try again."
            );
        } finally {
            setIsGoogleSubmitting(false);
        }
    }, [startSSOFlow]);

    return (
        <View
            className="flex-1 bg-bg-main"
            style={{
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
            }}
        >
            <View className="flex-1 px-screen-x pt-4">
                <View className="items-center mb-2">
                    <View className="w-16 h-16 rounded-xl bg-surface-selected-light border border-border-default items-center justify-center mb-4">
                        <Ionicons
                            name="lock-closed"
                            size={28}
                            color="#5FAEF7"
                        />
                    </View>

                    <Text className="text-text-white text-heading-md font-bold font-sans">
                        Welcome back
                    </Text>

                    <Text className="text-text-muted text-body-sm font-sans mt-1">
                        Unlock Vaultface to continue
                    </Text>
                </View>

                <View className="mt-6">
                    {/* Email */}
                    <Text className="text-text-secondary text-caption font-semibold font-sans mb-1.5">
                        Email
                    </Text>

                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        placeholderTextColor="#60748D"
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        className="w-full bg-surface-default border border-border-default rounded-md px-4 py-3.5 text-text-primary text-body font-sans mb-3"
                    />

                    {errors?.fields?.identifier?.message ? (
                        <Text className="text-danger text-caption font-sans mb-2 -mt-2">
                            {errors.fields.identifier.message}
                        </Text>
                    ) : null}

                    {/* Password */}
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
                            autoCapitalize="none"
                            autoCorrect={false}
                            className="flex-1 px-4 py-3.5 text-text-primary text-body font-sans"
                        />

                        <TouchableOpacity
                            onPress={() =>
                                setShowPassword((prev) => !prev)
                            }
                            className="px-3"
                            hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                            }}
                        >
                            {showPassword ? (
                                <EyeOff
                                    size={20}
                                    color="#60748D"
                                />
                            ) : (
                                <Eye
                                    size={20}
                                    color="#60748D"
                                />
                            )}
                        </TouchableOpacity>
                    </View>

                    {errors?.fields?.password?.message ? (
                        <Text className="text-danger text-caption font-sans mt-1.5">
                            {errors.fields.password.message}
                        </Text>
                    ) : null}

                    {/* General error */}
                    {formError ? (
                        <Text className="text-danger text-caption font-sans mt-3 text-center">
                            {formError}
                        </Text>
                    ) : null}

                    {/* Forgot password */}
                    <Pressable
                        className="my-6"
                        onPress={() =>
                            console.log(
                                "Forgot Password Press"
                            )
                        }
                    >
                        <Text className="text-balance text-primary font-semibold">
                            Forgot password?
                        </Text>
                    </Pressable>

                    {/* Login */}
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

                {/* Biometric / PIN */}
                <View className="flex-row items-center gap-3 my-5">
                    <View className="flex-1 h-px bg-border-default" />

                    <Text className="text-text-disabled text-caption font-sans">
                        or unlock with
                    </Text>

                    <View className="flex-1 h-px bg-border-default" />
                </View>

                <View className="flex-row gap-3">
                    {/* Face ID */}
                    <Pressable
                        onPress={handleFaceId}
                        className="flex-1 flex-row items-center justify-center gap-2 bg-surface-default border border-border-default rounded-md py-3.5 active:bg-surface-raised"
                    >
                        <Ionicons
                            name="scan-outline"
                            size={18}
                            color="#F3F6F9"
                        />

                        <Text className="text-text-primary text-body-sm font-semibold font-sans">
                            Face ID
                        </Text>
                    </Pressable>

                    {/* PIN */}
                    <Pressable
                        onPress={handleDevicePasscode}
                        className="flex-1 flex-row items-center justify-center gap-2 bg-surface-default border border-border-default rounded-md py-3.5 active:bg-surface-raised"
                    >
                        <Ionicons
                            name="keypad-outline"
                            size={18}
                            color="#F3F6F9"
                        />

                        <Text className="text-text-primary text-body-sm font-semibold font-sans">
                            PIN
                        </Text>
                    </Pressable>
                </View>

                <View className="flex-row items-center gap-3 my-5">
                    <View className="flex-1 h-px bg-border-default" />

                    <Text className="text-text-disabled text-caption font-sans">
                        or continue with
                    </Text>

                    <View className="flex-1 h-px bg-border-default" />
                </View>

                {/* Google */}
                <Pressable
                    onPress={handleGoogleAuth}
                    disabled={isGoogleSubmitting}
                    className="w-full flex-row items-center justify-center gap-2 bg-surface-default border border-border-default rounded-md py-3.5 active:bg-surface-raised disabled:opacity-50"
                >
                    {isGoogleSubmitting ? (
                        <ActivityIndicator color="#F3F6F9" />
                    ) : (
                        <>
                            <Ionicons
                                name="logo-google"
                                size={16}
                                color="#F3F6F9"
                            />

                            <Text className="text-text-primary text-body-sm font-semibold font-sans">
                                Continue with Google
                            </Text>
                        </>
                    )}
                </Pressable>

                {/* Sign up */}
                <View className="flex-row justify-center flex-wrap gap-x-1.5 mt-6">
                    <Text className="text-text-disabled text-caption font-sans">
                        Don&apos;t have an account?
                    </Text>

                    <Pressable
                        onPress={() =>
                            router.push("/SignUp")
                        }
                    >
                        <Text className="text-primary text-caption font-semibold font-sans">
                            Create an Account
                        </Text>
                    </Pressable>
                </View>
            </View>

            {/* PIN Coming Soon Modal */}
            <ComingSoonDialog
                visible={showComingSoonDialog}
                onClose={() =>
                    setShowComingSoonDialog(false)
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    dialogOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
    },

    dialog: {
        width: "100%",
        maxWidth: 360,
        backgroundColor: "#101C2B",
        borderRadius: 18,
        padding: 24,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#26384D",
    },

    dialogIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#1B2A3D",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },

    dialogIconText: {
        fontSize: 26,
    },

    dialogTitle: {
        color: "#F3F6F9",
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 8,
    },

    dialogBody: {
        color: "#9AAAC0",
        fontSize: 14,
        lineHeight: 21,
        textAlign: "center",
        marginBottom: 24,
    },

    dialogBtn: {
        width: "100%",
        minHeight: 46,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },

    dialogBtnCancel: {
        backgroundColor: "#1B2A3D",
        borderWidth: 1,
        borderColor: "#344960",
    },

    dialogBtnCancelText: {
        color: "#F3F6F9",
        fontSize: 15,
        fontWeight: "600",
    },
});
