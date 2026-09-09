// import "@/global.css";
// import { ensureVaultDir } from "@/lib/fileStorage";
// import { VaultLockProvider, useVaultLock } from "@/lib/VaultLockContext";
// import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
// import { Slot, useRouter, useSegments } from "expo-router";
// import { useEffect } from "react";
// import { ActivityIndicator, View } from "react-native";
// import { GestureHandlerRootView } from "react-native-gesture-handler";

// // TODO: replace with Clerk's useAuth() → { isLoaded, isSignedIn }
// // Hardcoded false so the (auth)/login screen is reachable for UI work
// // before Clerk is wired in. Flip to true locally if you need to jump
// // straight to vault setup/lock while building those screens instead.
// const STUB_IS_SIGNED_IN = false;

// export default function RootLayout() {
//   useEffect(() => {
//     ensureVaultDir();
//   }, []);

//   return (
//     <GestureHandlerRootView style={{ flex: 1 }}>
//       <BottomSheetModalProvider>
//         <VaultLockProvider>
//           <GatedNavigator />
//         </VaultLockProvider>
//       </BottomSheetModalProvider>
//     </GestureHandlerRootView>
//   );
// }

// function GatedNavigator() {
//   const { isInitializing, hasCompletedSetup, isUnlocked } = useVaultLock();
//   const router = useRouter();
//   const segments = useSegments();

//   // TODO: swap for Clerk's isLoaded/isSignedIn once wired in.
//   const isSignedIn = STUB_IS_SIGNED_IN;

//   useEffect(() => {
//     if (isInitializing) return;

//     const currentGroup = segments[0]; // e.g. "(auth)", "lock", "security-setup", "(tabs)", "folder"
//     const onAuthScreen =
//       currentGroup === "(auth)" ||
//       currentGroup === "lock" ||
//       currentGroup === "security-setup";

// if (!isSignedIn) {
//   if (currentGroup !== "(auth)") {
//     router.replace("/login");
//   }
//   return;
// }

// if (!hasCompletedSetup) {
//   if (currentGroup !== "security-setup") {
//     router.replace("/security-setup");
//   }
//   return;
// }

// if (!isUnlocked) {
//   if (currentGroup !== "lock") {
//     router.replace("/lock");
//   }
//   return;
// }

//     if (onAuthScreen) {
//       router.replace("/");
//     }
//   }, [isInitializing, isSignedIn, hasCompletedSetup, isUnlocked, segments, router]);

//   if (isInitializing) {
//     return (
//       <View
//         style={{
//           flex: 1,
//           alignItems: "center",
//           justifyContent: "center",
//           backgroundColor: "#010617",
//         }}
//       >
//         <ActivityIndicator size="large" color="#5FAEF7" />
//       </View>
//     );
//   }

//   return <Slot />;
// }


import "@/global.css";
import { ensureVaultDir } from "@/lib/fileStorage";
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from "expo-router";
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error('Add your Clerk Publishable Key to the .env file');
}

export default function RootLayout() {
  useEffect(() => {
    ensureVaultDir();
  }, []);

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}