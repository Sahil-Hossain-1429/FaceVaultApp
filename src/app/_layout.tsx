import "@/global.css";
import { ensureVaultDir } from "@/lib/fileStorage";
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from "expo-router";
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error('Add your Clerk Publishable Key to the .env file');
}

const CURRENT_MODEL_VERSION = 'sface_v1';
const MIGRATION_KEY = 'face_vault_model_version';

async function migrateIfNeeded(): Promise<void> {
  const stored = await SecureStore.getItemAsync(MIGRATION_KEY);
  if (stored === CURRENT_MODEL_VERSION) return;

  console.log('[migration] model version mismatch — clearing old enrollment');
  await SecureStore.setItemAsync(MIGRATION_KEY, CURRENT_MODEL_VERSION);
  console.log('[migration] done — user will re-enroll on next vault open');
}

export default function RootLayout() {
  useEffect(() => {
    ensureVaultDir();
    migrateIfNeeded();
  }, []);

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}