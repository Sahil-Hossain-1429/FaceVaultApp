import { VerifyEmailScreen } from "@/app/(auth)/SignUp/verifyEmailScreen";
import { useAuth, useSignUp } from "@clerk/expo";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";

export default function CreateAccountScreen() {
    const { signUp, errors, fetchStatus } = useSignUp();
    const { isSignedIn } = useAuth();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [code, setCode] = useState("");
    const [confirmMismatch, setConfirmMismatch] = useState(false);

    const isFetching = fetchStatus === "fetching";

    // create the sign-up attempt with email + password, then send the OTP
    const handleContinue = async () => {
        setConfirmMismatch(false);

        if (password !== confirmPassword) {
            setConfirmMismatch(true);
            return;
        }

        const { error } = await signUp.password({
            emailAddress: email,
            password,
        });

        if (error) {
            console.error(JSON.stringify(error, null, 2));
            return;
        }

        await signUp.verifications.sendEmailCode();
    };

    // verify the OTP and finalize the session
    const handleVerify = async () => {
        await signUp.verifications.verifyEmailCode({ code });

        if (signUp.status === "complete") {
            await signUp.finalize({
                navigate: ({ session }) => {
                    if (session?.currentTask) {
                        // e.g. org selection or other pending session task
                        console.log(session.currentTask);
                        return;
                    }
                    // router.replace("/FaceRecognitionSetup");
                    // Todo Need to update the location with Gated Navigation
                },
            });
        } else {
            console.error("Sign-up attempt not complete:", signUp);
        }
    };

    const handleGoogleSignUp = () => {
        // TODO: wire useOAuth({ strategy: "oauth_google" })
        console.log("Sign up with Google pressed");
    };

    const verifyEmailView = (
        <VerifyEmailScreen
            signUp={signUp}
            isSignedIn={isSignedIn}
            email={email}
            code={code}
            setCode={setCode}
            handleVerify={handleVerify}
            isFetching={isFetching}
        />
    );


    const isVerifyingEmail =
        signUp.status === "missing_requirements" &&
        Array.isArray(signUp.unverifiedFields) &&
        signUp.unverifiedFields.includes("email_address") &&
        Array.isArray(signUp.missingFields) &&
        signUp.missingFields.length === 0;

    if (signUp.status === "complete" || isSignedIn) {
        return null;
    }

    if (isVerifyingEmail) {
        return verifyEmailView;
    }

    return (
        <View className="flex-1 bg-bg-main">
            <ScrollView
                className="flex-1"
                contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: "center",
                    paddingHorizontal: 20,
                    paddingVertical: 24,
                }}
                keyboardShouldPersistTaps="handled"
            >
                <Text className="text-heading-lg font-sans font-bold text-text-white mb-5">
                    Create your account
                </Text>

                {/* Email */}
                <Text className="text-body font-sans font-semibold text-text-secondary mb-1.5">
                    Email
                </Text>
                <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="#60748D"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="w-full bg-surface-default border border-border-default rounded-md px-4 py-3.5 text-body font-sans text-text-primary mb-1"
                />
                {errors.fields.emailAddress && (
                    <Text className="text-body-sm font-sans text-danger mb-2">
                        {errors.fields.emailAddress.message}
                    </Text>
                )}

                {/* Password */}
                <Text className="text-body font-sans font-semibold text-text-secondary mb-1.5 mt-2">
                    Password
                </Text>
                <View className="w-full flex-row items-center bg-surface-default border border-border-default rounded-md mb-1">
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Create a strong password"
                        placeholderTextColor="#60748D"
                        secureTextEntry={!showPassword}
                        className="flex-1 px-4 py-3.5 text-body font-sans text-text-primary"
                    />
                    <Pressable
                        onPress={() => setShowPassword((prev) => !prev)}
                        hitSlop={8}
                        className="pr-4 pl-2"
                    >
                        <Ionicons
                            name={showPassword ? "eye-off-outline" : "eye-outline"}
                            size={20}
                            color="#8698B4"
                        />
                    </Pressable>
                </View>
                {errors.fields.password && (
                    <Text className="text-body-sm font-sans text-danger mb-2">
                        {errors.fields.password.message}
                    </Text>
                )}

                {/* Confirm Password */}
                <Text className="text-body font-sans font-semibold text-text-secondary mb-1.5 mt-2">
                    Confirm password
                </Text>
                <View className="w-full flex-row items-center bg-surface-default border border-border-default rounded-md mb-1">
                    <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Re-enter your password"
                        placeholderTextColor="#60748D"
                        secureTextEntry={!showPassword}
                        className="flex-1 px-4 py-3.5 text-body font-sans text-text-primary"
                    />
                    <Pressable
                        onPress={() => setShowPassword((prev) => !prev)}
                        hitSlop={8}
                        className="pr-4 pl-2"
                    >
                        <Ionicons
                            name={showPassword ? "eye-off-outline" : "eye-outline"}
                            size={20}
                            color="#8698B4"
                        />
                    </Pressable>
                </View>
                {confirmMismatch && (
                    <Text className="text-body-sm font-sans text-danger mb-2">
                        Passwords don&apos;t match.
                    </Text>
                )}

                {/* Continue Button */}
                <Pressable
                    onPress={handleContinue}
                    disabled={!email || !password || !confirmPassword || isFetching}
                    className="w-full bg-primary rounded-md py-4 items-center justify-center active:bg-primary-hover my-4 disabled:opacity-40"
                >
                    {isFetching ? (
                        <ActivityIndicator color="#04101F" />
                    ) : (
                        <Text
                            className="text-body font-sans font-semibold"
                            style={{ color: "#04101F" }}
                        >
                            Continue
                        </Text>
                    )}
                </Pressable>

                {/* Divider */}
                <View className="flex-row items-center gap-3 my-1">
                    <View className="flex-1 h-px bg-border-default" />
                    <Text className="text-caption font-sans text-text-disabled">or</Text>
                    <View className="flex-1 h-px bg-border-default" />
                </View>

                {/* Google Sign Up */}
                <Pressable
                    onPress={handleGoogleSignUp}
                    className="w-full bg-surface-default border border-border-default rounded-md py-4 mt-4 flex-row items-center justify-center gap-2 active:bg-surface-raised"
                >
                    <Ionicons name="logo-google" size={16} color="#F3F6F9" />
                    <Text className="text-body font-sans font-semibold text-text-primary">
                        Sign up with Google
                    </Text>
                </Pressable>

                <Text className="text-label font-sans text-text-disabled text-center mt-5 leading-5">
                    By continuing you agree to the Terms of Service and Privacy Policy.
                </Text>

                {/* Required on Expo web only — Clerk skips bot-protection natively on iOS/Android */}
                <View nativeID="clerk-captcha" />
            </ScrollView>
        </View>
    );
}