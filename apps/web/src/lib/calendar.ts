import "server-only";

import type { Recurrence } from "@orvelia/domain";
import { createClient } from "@/lib/supabase/server";

export type CalendarEventKind = "warranty" | "return" | "document" | "reminder";

export type CalendarEvent = {
  key: string;
  kind: CalendarEventKind;
  /** YYYY-MM-DD in the user's time zone. */
  date: string;
  title: string;
  href: string;
  time?: string;
  /** Set for dates from a product another family member shares. */
  sharedBy?: string;
};

export type ReminderRow = {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  source: "warranty" | "return" | "document" | "custom";
  recurrence: Recurrence;
  productId: string | null;
  productName: string | null;
  email: boolean;
};

type NameRef = { name: string } | { name: string }[] | null;
const nameOf = (p: NameRef) => (Array.isArray(p) ? p[0]?.name : p?.name) ?? null;

function localParts(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
}

/** Everything with a date between `from` and `to` (inclusive, YYYY-MM-DD). */
export async function getCalendarEvents(userId: string, from: string, to: string, timeZone: string): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  // Pad the timestamp window by a day on each side; filtered to local dates below.
  const fromTs = new Date(Date.parse(`${from}T00:00:00Z`) - 86_400_000).toISOString();
  const toTs = new Date(Date.parse(`${to}T23:59:59Z`) + 86_400_000).toISOString();

  const [w, r, d, rem, fam] = await Promise.all([
    supabase
      .from("warranties")
      .select("id, end_date, product_id, products!warranties_product_fk(name)")
      .eq("user_id", userId)
      .gte("end_date", from)
      .lte("end_date", to),
    supabase
      .from("return_deadlines")
      .select("id, deadline_date, product_id, products!return_deadlines_product_fk(name)")
      .eq("user_id", userId)
      .gte("deadline_date", from)
      .lte("deadline_date", to),
    supabase
      .from("documents")
      .select("id, title, expires_on, product_id")
      .eq("user_id", userId)
      .gte("expires_on", from)
      .lte("expires_on", to),
    supabase
      .from("reminders")
      .select("id, title, scheduled_at, product_id")
      .eq("user_id", userId)
      .eq("source", "custom")
      .in("status", ["scheduled", "sent"])
      .gte("scheduled_at", fromTs)
      .lte("scheduled_at", toTs),
    supabase.rpc("family_shared_events", { p_from: from, p_to: to }),
  ]);
  const err = w.error ?? r.error ?? d.error ?? rem.error ?? fam.error;
  if (err) throw new Error(`No se pudo cargar el calendario: ${err.message}`);

  const events: CalendarEvent[] = [
    ...(w.data ?? []).map((x) => ({
      key: `w-${x.id}`,
      kind: "warranty" as const,
      date: x.end_date!,
      title: `Vence la garantía: ${nameOf(x.products as NameRef) ?? "producto"}`,
      href: `/app/products/${x.product_id}#garantia`,
    })),
    ...(r.data ?? []).map((x) => ({
      key: `r-${x.id}`,
      kind: "return" as const,
      date: x.deadline_date,
      title: `Último día para devolver: ${nameOf(x.products as NameRef) ?? "producto"}`,
      href: `/app/products/${x.product_id}#garantia`,
    })),
    ...(d.data ?? []).map((x) => ({
      key: `d-${x.id}`,
      kind: "document" as const,
      date: x.expires_on!,
      title: `Vence: ${x.title}`,
      href: x.product_id ? `/app/products/${x.product_id}` : "/app/documents",
    })),
    ...(rem.data ?? []).flatMap((x) => {
      const local = localParts(x.scheduled_at, timeZone);
      if (local.date < from || local.date > to) return [];
      return [
        {
          key: `m-${x.id}`,
          kind: "reminder" as const,
          date: local.date,
          time: local.time,
          title: x.title,
          href: x.product_id ? `/app/products/${x.product_id}` : "/app/calendar",
        },
      ];
    }),
    ...(fam.data ?? []).map((x, i) => ({
      key: `f-${x.kind}-${x.product_id}-${x.event_date}-${i}`,
      kind: x.kind,
      date: x.event_date,
      title:
        x.kind === "warranty"
          ? `Vence la garantía: ${x.product_name}`
          : x.kind === "return"
            ? `Último día para devolver: ${x.product_name}`
            : `${x.title} (${x.product_name})`,
      href: `/app/family/products/${x.product_id}`,
      sharedBy: x.owner_name ?? "Familia",
    })),
  ];

  return events.sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
}

/** Scheduled reminders (automatic and custom), soonest first. */
export async function listUpcomingReminders(userId: string, limit = 30): Promise<ReminderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reminders")
    .select("id, title, description, scheduled_at, source, recurrence, product_id, notification_channels, products!reminders_product_fk(name)")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .order("scheduled_at")
    .limit(limit);
  if (error) throw new Error(`No se pudieron cargar los recordatorios: ${error.message}`);
  return (data ?? []).map((x) => ({
    id: x.id,
    title: x.title,
    description: x.description,
    scheduledAt: x.scheduled_at,
    source: x.source,
    recurrence: x.recurrence,
    productId: x.product_id,
    productName: nameOf(x.products as NameRef),
    email: x.notification_channels.includes("email"),
  }));
}
