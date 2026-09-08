import Ionicons from "@react-native-vector-icons/ionicons";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

export default function CreateAccountScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleContinue = () => {
        // TODO: wire Clerk useSignUp
        console.log("Continue pressed", { name, email, password, confirmPassword });
    };

    const handleGoogleSignUp = () => {
        // TODO: wire useOAuth({ strategy: "oauth_google" })
        console.log("Sign up with Google pressed");
    };

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
                    className="w-full bg-surface-default border border-border-default rounded-md px-4 py-3.5 text-body font-sans text-text-primary mb-3"
                />

                {/* Password */}
                <Text className="text-body font-sans font-semibold text-text-secondary mb-1.5">
                    Password
                </Text>
                <View className="w-full flex-row items-center bg-surface-default border border-border-default rounded-md mb-3">
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

                {/* Confirm Password */}
                <Text className="text-body font-sans font-semibold text-text-secondary mb-1.5">
                    Confirm password
                </Text>
                <View className="w-full flex-row items-center bg-surface-default border border-border-default rounded-md mb-5">
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

                {/* Continue Button */}
                <Pressable
                    onPress={handleContinue}
                    className="w-full bg-primary rounded-md py-4 items-center justify-center active:bg-primary-hover my-4"
                >
                    <Text className="text-body font-sans font-semibold" style={{ color: "#04101F" }}>
                        Continue
                    </Text>
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
            </ScrollView>
        </View>
    );
}