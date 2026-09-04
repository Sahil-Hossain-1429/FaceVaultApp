import { Stack } from "expo-router";

export default function FolderLayout() {
    return (
        <Stack>
            <Stack.Screen
                name="[folderId]"
                options={{
                    headerShown: false,
                }}
            />
        </Stack>
    );
}