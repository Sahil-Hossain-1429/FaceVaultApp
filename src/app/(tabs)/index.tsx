import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VaultCard } from "../../../components/VaultCard";

export default function App() {
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
            onPress={() => { }}
          />
          <VaultCard
            icon="images"
            title="Images"
            count="0"
            iconColor="#38C97A"
            iconBg="rgba(56,201,122,0.12)"
            onPress={() => { }}
          />
          <VaultCard
            icon="document-text"
            title="Documents"
            count="0"
            iconColor="#F5A623"
            iconBg="rgba(245,166,35,0.12)"
            onPress={() => { }}
          />
          <VaultCard
            icon="document-attach"
            title="Other Files"
            count="0"
            iconColor="#9D7BEA"
            iconBg="rgba(157,123,234,0.12)"
            onPress={() => { }}
          />
        </View>
      </SafeAreaView>

      <View style={{
        position: 'absolute',
        right: 20,
        bottom: 20,
      }}>
        <Pressable
          onPress={() => console.log('Add + Button pressed')}
          className="bg-primary w-20 h-20 rounded-full items-center justify-center active:opacity-80"
        >
          <Ionicons name="add" size={28} color="#ffffff" />
        </Pressable>
      </View>
    </View>
  );
}