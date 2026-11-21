import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as React from "react";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useNotificationRouting } from "@/lib/push";
import { SessionProvider, useSession } from "@/lib/session";
import { useColors } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { session, loading } = useSession();
  const c = useColors();
  useNotificationRouting();
  React.useEffect(() => {
    if (!loading) void SplashScreen.hideAsync().catch(() => undefined);
  }, [loading]);
  if (loading) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.foreground,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="product/new" options={{ title: "Agregar producto", presentation: "modal" }} />
        <Stack.Screen name="product/[id]" options={{ title: "" }} />
        <Stack.Screen name="receipt/[id]" options={{ title: "Revisar comprobante" }} />
        <Stack.Screen name="shared/[id]" options={{ title: "Compartido" }} />
        <Stack.Screen name="notifications" options={{ title: "Avisos" }} />
        <Stack.Screen name="assistant" options={{ title: "ORVELIA AI" }} />
        <Stack.Screen name="delete-account" options={{ title: "Eliminar cuenta" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <SessionProvider>
          <StatusBar style="auto" />
          <RootNavigator />
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
