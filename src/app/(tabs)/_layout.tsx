import Ionicons from '@react-native-vector-icons/ionicons';
import { Tabs } from "expo-router";


const TabLayout = () => (
    <Tabs screenOptions={{ headerShown: false }}>
        {/* <Tabs.Screen name="index" options={{ title: 'Home' }} /> */}
        <Tabs.Screen
            name="index"
            options={{
                title: 'Home',
                tabBarIcon: ({ color, size, focused }) => (
                    <Ionicons
                        name={focused ? 'home' : 'home-outline'}
                        size={size}
                        color={color}
                    />
                ),
            }}
        />
        <Tabs.Screen
            name="settings"
            options={{
                title: "Settings",
                tabBarIcon: ({ color, size, focused }) => (
                    <Ionicons
                        name={focused ? 'settings' : 'settings-outline'}
                        size={size}
                        color={color}
                    />
                )
            }}
        />
    </Tabs>
)

export default TabLayout