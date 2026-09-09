import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";

type VerifyEmailScreenProps = {
    signUp: any; // replace with the real Clerk SignUp resource type if you have it imported
    isSignedIn: boolean | undefined;
    email: string;
    code: string;
    setCode: (code: string) => void;
    handleVerify: () => void;
    isFetching: boolean;
};

export function VerifyEmailScreen({
    signUp,
    isSignedIn,
    email,
    code,
    setCode,
    handleVerify,
    isFetching,
}: VerifyEmailScreenProps) {
    const isVerifyingEmail =
        signUp.status === "missing_requirements" &&
        Array.isArray(signUp.unverifiedFields) &&
        signUp.unverifiedFields.includes("email_address") &&
        Array.isArray(signUp.missingFields) &&
        signUp.missingFields.length === 0;

    // Once the sign-up is complete (or the session is already active from a
    // prior attempt), stop rendering this screen entirely. Without this guard,
    // a leftover/transitioning signUp object during the post-finalize
    // navigation race can still satisfy isVerifyingEmail and try to render
    // the verify form against a resource that's no longer valid.
    if (signUp.status === "complete" || isSignedIn) {
        return null;
    }

    if (!isVerifyingEmail) {
        return null;
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
                <Text className="text-heading-lg font-sans font-bold text-text-white mb-1.5">
                    Verify your email
                </Text>
                <Text className="text-body font-sans text-text-muted mb-5">
                    Enter the code we sent to {email}
                </Text>

                <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="123456"
                    placeholderTextColor="#60748D"
                    keyboardType="number-pad"
                    maxLength={6}
                    style={{ textAlign: "center" }}
                    className="w-full bg-surface-default border border-border-default rounded-md px-4 py-3.5 text-body font-sans text-text-primary mb-1.5"
                />
                {signUp.errors?.fields?.code && (
                    <Text className="text-body-sm font-sans text-danger mb-2">
                        {signUp.errors.fields.code.message}
                    </Text>
                )}

                <Pressable
                    onPress={handleVerify}
                    disabled={!code || isFetching}
                    className="w-full bg-primary rounded-md py-4 items-center justify-center active:bg-primary-hover mt-4 disabled:opacity-40"
                >
                    {isFetching ? (
                        <ActivityIndicator color="#04101F" />
                    ) : (
                        <Text
                            className="text-body font-sans font-semibold"
                            style={{ color: "#04101F" }}
                        >
                            Verify
                        </Text>
                    )}
                </Pressable>

                <Pressable
                    onPress={() => signUp.verifications.sendEmailCode()}
                    className="mt-4"
                >
                    <Text className="text-body-sm font-sans text-primary text-center">
                        I need a new code
                    </Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}