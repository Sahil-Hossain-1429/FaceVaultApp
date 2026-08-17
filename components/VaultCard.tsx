import Ionicons from '@react-native-vector-icons/ionicons';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from "react-native";

type VaultCardProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  count: string;
  iconColor: string;
  iconBg: string;
  onPress?: () => void;
};

export function VaultCard({
  icon,
  title,
  count,
  iconColor,
  iconBg,
  onPress,
}: VaultCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="w-[48%] bg-surface-default border border-border-default rounded-lg p-4 active:bg-surface-raised active:border-border-strong"
    >
      <View
        className="w-[38px] h-[38px] rounded-sm items-center justify-center mb-6"
        style={{ backgroundColor: iconBg }}
      >
        <Ionicons name={icon} size={19} color={iconColor} />
      </View>

      <Text className="text-text-primary text-heading-sm font-semibold font-sans">
        {title}
      </Text>
      <Text className="text-text-muted text-caption font-sans mt-0.5">
        {count} {title}
      </Text>
    </Pressable>
  );
}