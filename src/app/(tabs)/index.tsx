import { importFile } from '@/lib/fileStorage';
import {
  BottomSheetModal,
  BottomSheetView
} from '@gorhom/bottom-sheet';
import Ionicons from '@react-native-vector-icons/ionicons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomSheetCard } from '../../../components/BottomSheetCard';
import { VaultCard } from "../../../components/VaultCard";

export default function App() {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handlePresentAddSheet = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const handleAddFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      for (const asset of result.assets){
        importFile(asset.uri, 'documents', asset.name);
      }
    } catch (err) {
      console.error('Document picker error:', err);
    }
  }

  const handleAddPhotos = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Photo library access is required to add images to your vault.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (result.canceled) return;

    for(const asset of result.assets){
      const fileName = asset.fileName ?? `img_${Date.now()}.jpg`;
      importFile(asset.uri, 'images', fileName);
    }

    console.log('Picked files:', result.assets);
  }

  return (
    <View className="flex-1 bg-bg-main p-5">
      <SafeAreaView>
        <Text className="text-text-white text-display font-bold">
          My Vault
        </Text>
        <Text className="text-text-muted">
          0 items . 0 GB used
        </Text>
        <Text className="text-display text-text-secondary font-bold mt-5">
          Categories
        </Text>
        <View className="flex-row flex-wrap justify-between gap-y-3 py-3">
          <VaultCard
            icon="folder"
            title="Folders"
            count="0"
            iconColor="#5FAEF7"
            iconBg="rgba(95,174,247,0.12)"
            onPress={() => {}}
          />
          <VaultCard
            icon="images"
            title="Images"
            count="0"
            iconColor="#38C97A"
            iconBg="rgba(56,201,122,0.12)"
            onPress={() => router.push('/folder/images')}
          />
          <VaultCard
            icon="document-text"
            title="Documents"
            count="0"
            iconColor="#F5A623"
            iconBg="rgba(245,166,35,0.12)"
            onPress={() => router.push('/folder/documents')}
          />
          <VaultCard
            icon="document-attach"
            title="Other Files"
            count="0"
            iconColor="#9D7BEA"
            iconBg="rgba(157,123,234,0.12)"
            onPress={() => router.push('/folder/Other Files')}
          />
        </View>
      </SafeAreaView>

      <View style={{
        position: 'absolute',
        right: 20,
        bottom: 20,
      }}>
        <Pressable
          onPress={handlePresentAddSheet}
          className="bg-primary w-20 h-20 rounded-full items-center justify-center active:opacity-80"
        >
          <Ionicons name="add" size={28} color="#ffffff" />
        </Pressable>
      </View>


      <BottomSheetModal
        ref={bottomSheetModalRef}
        // onChange={handleSheetChanges}
        enableDynamicSizing
        backgroundStyle={{ backgroundColor: '#1B293C' }}
        handleIndicatorStyle={{ backgroundColor: '#43556B' }}
      >
        <BottomSheetView className="px-5 pb-8">
          <Text className="text-heading-sm font-bold text-text-white px-1.5 pb-1.5">
            Add to Vault
          </Text>

          <BottomSheetCard
            icon="folder-outline"
            title="Create New Folder"
            subtitle="Organize files into a folder"
            onPress={() => {
              bottomSheetModalRef.current?.dismiss();
              // trigger folder-name prompt
            }}
          />
          <BottomSheetCard
            icon="images-outline"
            title="Add Photos / Images"
            subtitle="From your camera roll"
            onPress={() => {
              bottomSheetModalRef.current?.dismiss();
              setTimeout(handleAddPhotos, 300);
            }}
          />
          <BottomSheetCard
            icon="document-text-outline"
            title="Add Documents"
            subtitle="PDF, Word, and more"
            onPress={() => {
              bottomSheetModalRef.current?.dismiss();
              setTimeout(handleAddFiles, 300);
            }}
          />
          <BottomSheetCard
            icon="document-attach-outline"
            title="Add Files"
            subtitle="Any file from your device"
            onPress={() => {
              bottomSheetModalRef.current?.dismiss();
              setTimeout(handleAddFiles, 300);
            }}
          />

          <Pressable
            onPress={() => bottomSheetModalRef.current?.dismiss()}
            className="bg-surface-default border border-border-default rounded-xl py-4 items-center mt-3.5"
          >
            <Text className="text-text-primary font-semibold text-body">Cancel</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>


    </View>
  );
}