// import { useVaultLock } from "@/lib/VaultLockContext";
import { Pressable, Text, View } from "react-native";

export default function SecuritySetupScreen() {
    // const { completeSecuritySetup } = useVaultLock();

    return (
        <View
            style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#010617",
                gap: 16,
            }}
        >
            <Text style={{ color: "#F3F6F9", fontSize: 18, fontWeight: "700" }}>
                Set Up Vault Security
            </Text>
            <Pressable
                // onPress={() => completeSecuritySetup()}
                style={{
                    backgroundColor: "#5FAEF7",
                    paddingVertical: 14,
                    paddingHorizontal: 28,
                    borderRadius: 12,
                }}
            >
                <Text style={{ color: "#04101f", fontWeight: "700" }}>
                    Complete Setup
                </Text>
            </Pressable>
        </View>
    );
}