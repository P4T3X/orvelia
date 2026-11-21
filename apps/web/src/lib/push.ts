import "server-only";

/**
 * Push notifications through the Expo Push Service (delivers to APNs and FCM
 * for the ORVELIA mobile app). Tokens the service reports as unregistered are
 * returned so the caller can delete them.
 */
export type PushMessage = { to: string; title: string; body?: string; data?: Record<string, string> };
export type PushResult = { sent: number; failed: number; unregistered: string[] };

const CHUNK = 100;

export async function sendPush(messages: PushMessage[]): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, unregistered: [] };
  if (messages.length === 0) return result;
  const url = process.env.EXPO_PUSH_URL ?? "https://exp.host/--/api/v2/push/send";
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(chunk.map((m) => ({ ...m, sound: "default", priority: "high", channelId: "reminders" }))),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        result.failed += chunk.length;
        console.error("[push] HTTP", res.status, (await res.text()).slice(0, 200));
        continue;
      }
      const body = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
      (body.data ?? []).forEach((ticket, idx) => {
        if (ticket.status === "ok") result.sent++;
        else {
          result.failed++;
          if (ticket.details?.error === "DeviceNotRegistered") result.unregistered.push(chunk[idx]!.to);
        }
      });
    } catch (e) {
      result.failed += chunk.length;
      console.error("[push] network", e instanceof Error ? e.message : e);
    }
  }
  return result;
}
