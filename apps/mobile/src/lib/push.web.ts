// Push notifications are native-only; the web build (previews, tests) skips them.
export type PushRegistration = { status: "registered"; token: string } | { status: "denied" | "unavailable"; reason: string };
export async function registerForPush(): Promise<PushRegistration> {
  return { status: "unavailable", reason: "Las notificaciones push solo funcionan en la app del teléfono." };
}
export async function unregisterPush() {}
export function useNotificationRouting() {}
