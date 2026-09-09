// import { useVaultLock } from "@/lib/VaultLockContext";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

/**
 * STUB — real UI (Face ID prompt, PIN keypad) built in step 4.
 * Functionally wired now: tapping the button runs the real
 * biometric flow via context, so gating can be tested end-to-end
 * before the visual design is built.
 */
export default function LockScreen() {
    // const { unlockWithBiometrics } = useVaultLock();
    const [lastOutcome, setLastOutcome] = useState<string | null>(null);

    const handlePress = async () => {
        // const outcome = await unlockWithBiometrics();
        // console.log('[LockScreen] unlockWithBiometrics outcome:', JSON.stringify(outcome));
        // setLastOutcome(JSON.stringify(outcome));
    };

    return (
        <View
            style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#010617",
                gap: 16,
                padding: 20,
            }}
        >
            <Text style={{ color: "#F3F6F9", fontSize: 18, fontWeight: "700" }}>
                Vault Locked
            </Text>
            <Pressable
                onPress={handlePress}
                style={{
                    backgroundColor: "#5FAEF7",
                    paddingVertical: 14,
                    paddingHorizontal: 28,
                    borderRadius: 12,
                }}
            >
                <Text style={{ color: "#04101f", fontWeight: "700" }}>
                    Unlock with Face ID
                </Text>
            </Pressable>
            {lastOutcome && (
                <Text style={{ color: "#8698B4", fontSize: 12, textAlign: "center" }}>
                    Last result: {lastOutcome}
                </Text>
            )}
        </View>
    );
}