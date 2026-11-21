import { Feather } from "@expo/vector-icons";
import { Platform, type ColorValue } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import type { IconName } from "@/components/ui";
import { useColors } from "@/lib/theme";

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Feather name={name} size={size - 2} color={typeof color === "string" ? color : undefined} />;

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accentInk,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, ...(Platform.OS === "web" ? { height: 64, paddingBottom: 8 } : null) },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio", tabBarIcon: icon("home") }} />
      <Tabs.Screen name="products" options={{ title: "Colección", tabBarIcon: icon("package") }} />
      <Tabs.Screen name="scan" options={{ title: "Escanear", tabBarIcon: icon("camera") }} />
      <Tabs.Screen name="upcoming" options={{ title: "Próximos", tabBarIcon: icon("calendar") }} />
      <Tabs.Screen name="settings" options={{ title: "Ajustes", tabBarIcon: icon("settings") }} />
    </Tabs>
  );
}
