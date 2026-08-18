import "@/global.css";
import { ensureVaultDir } from "@/lib/fileStorage";
import { VaultLockProvider, useVaultLock } from "@/lib/VaultLockContext";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  useEffect(() => {
    ensureVaultDir();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <VaultLockProvider>
          <GatedNavigator />
        </VaultLockProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

function GatedNavigator() {
  const { isInitializing, hasCompletedSetup, isUnlocked } = useVaultLock();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isInitializing) return;

    const currentGroup = segments[0]; // e.g. "lock", "security-setup", "(tabs)", "folder"
    const onAuthScreen = currentGroup === "lock" || currentGroup === "security-setup";

    if (!hasCompletedSetup) {
      if (currentGroup !== "security-setup") {
        router.replace("/security-setup");
      }
      return;
    }

    if (!isUnlocked) {
      if (currentGroup !== "lock") {
        router.replace("/lock");
      }
      return;
    }

    if (onAuthScreen) {
      router.replace("/");
    }
  }, [isInitializing, hasCompletedSetup, isUnlocked, segments, router]);

  if (isInitializing) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#010617",
        }}
      >
        <ActivityIndicator size="large" color="#5FAEF7" />
      </View>
    );
  }

  return <Slot />;
}