import Ionicons from '@react-native-vector-icons/ionicons';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from "react-native";

type BottomSheetCardProps = {
    icon: ComponentProps<typeof Ionicons>['name'];
    title: string;
    subtitle: string;
    onPress?: () => void;
};

export function BottomSheetCard({
    icon,
    title,
    subtitle,
    onPress,
}: BottomSheetCardProps) {
    return (
        <Pressable
            onPress={onPress}
            className="flex-row items-center gap-3.5 py-3.5 px-1.5 border-b border-border-default active:bg-surface-raised"
        >
            <View className="w-10 h-10 rounded-[11px] bg-surface-selected-light items-center justify-center">
                <Ionicons name={icon} size={18} color="#5FAEF7" />
            </View>
            <View className="flex-1">
                <Text className="text-body font-semibold text-text-primary">
                    {title}
                </Text>
                <Text className="text-caption text-text-muted mt-0.5">
                    {subtitle}
                </Text>
            </View>
        </Pressable>
    );
}