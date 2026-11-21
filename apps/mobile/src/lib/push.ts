import { registerPushToken, unregisterPushToken } from "@orvelia/api";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import * as React from "react";
import { Platform } from "react-native";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushRegistration = { status: "registered"; token: string } | { status: "denied" | "unavailable"; reason: string };

let lastToken: string | null = null;

/** Asks for permission (once), gets the Expo push token and stores it for this account. */
export async function registerForPush(): Promise<PushRegistration> {
  if (!Device.isDevice) return { status: "unavailable", reason: "Las notificaciones push necesitan un teléfono real." };
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Recordatorios",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#C7A66A",
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return { status: "denied", reason: "Activa las notificaciones de ORVELIA en los ajustes del teléfono." };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { status: "unavailable", reason: "Falta el projectId de EAS en la configuración." };
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await registerPushToken(supabase, token, Platform.OS === "ios" ? "ios" : "android", Device.deviceName);
  lastToken = token;
  return { status: "registered", token };
}

/** Called on sign-out so this device stops receiving the account's reminders. */
export async function unregisterPush() {
  if (lastToken) await unregisterPushToken(supabase, lastToken).catch(() => undefined);
  lastToken = null;
}

/** Opens the screen a reminder points to when the person taps the notification. */
export function useNotificationRouting() {
  React.useEffect(() => {
    const open = (data: unknown) => {
      const path = (data as { path?: unknown } | undefined)?.path;
      if (typeof path === "string" && /^\/(products\/[0-9a-f-]{36}|calendar)$/.test(path)) {
        router.push(path.startsWith("/products/") ? `/product/${path.slice("/products/".length)}` : "/upcoming");
      }
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification.request.content.data);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    return () => sub.remove();
  }, []);
}
