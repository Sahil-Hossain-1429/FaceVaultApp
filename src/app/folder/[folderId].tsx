import { listFolder } from '@/lib/fileStorage';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Directory, File } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/build/react-navigation';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes > 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FolderViewer() {
    const { folderId } = useLocalSearchParams<{ folderId: string }>();
    const router = useRouter();
    const [items, setItems] = useState<(File | Directory)[]>([]);

    const refresh = useCallback(() => {
        if (!folderId) return;
        setItems(listFolder(folderId));
    }, [folderId]);

    useFocusEffect(refresh);

    return (
        <View className="flex-1 bg-bg-main">
            <SafeAreaView className="flex-1 px-5">
                <View className="flex-row items-center justify-between py-3">
                    <Pressable onPress={()=> router.back()} className='w-9 h-9 items-center justify-center'>
                        <Ionicons name="chevron-back" size={22} color="#F3F6F9"/>
                    </Pressable>
                    <Text className='text-heading-md font-bold text-text-white capitalize'>
                        {folderId}
                    </Text>
                    <View className="w-9 h-9"/>
                </View>

                <FlatList
                data={items}
                keyExtractor={(item) => item.uri}
                contentContainerStyle={{paddingVertical: 8}}
                ListEmptyComponent={
                    <Text className='text-text-muted text-center mt-10'>
                        No Files Yet
                    </Text>
                }
                renderItem={({item}) => {
                    const isDir = item instanceof Directory;
                    return(
                        <Pressable className='flex-row items-center gap-3 py-3 border-b border-border-default'>
                            <View className='w-10 h-10 rounded-lg bg-surface-selected-light items-center justify-center'>
                                <Ionicons 
                                name={isDir ? 'folder' : 'document-text'}
                                size={18}
                                color="#5FAEF7"
                                />
                            </View>
                            <View className='flex-1'>
                                <Text className='text-text-primary font-semibold text-body'>
                                    {item.name}
                                </Text>
                                <Text className='text-text-muted text-caption'>
                                    {isDir ? 'Folder' : formatBytes((item as File).size)}
                                </Text>
                            </View>
                        </Pressable>
                    );
                }}
                />
            </SafeAreaView>
        </View>
    );
}