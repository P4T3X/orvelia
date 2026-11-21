import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { NewReminderButton, ReminderList } from "@/components/calendar/reminder-controls";
import { Button } from "@/components/ui/button";
import { getProfile, requireUser } from "@/lib/auth";
import { getCalendarEvents, listUpcomingReminders, type CalendarEventKind } from "@/lib/calendar";
import { todayIn } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendario" };

const KIND: Record<CalendarEventKind, { label: string; dot: string }> = {
  warranty: { label: "Garantía", dot: "bg-accent" },
  return: { label: "Devolución", dot: "bg-danger" },
  document: { label: "Documento", dot: "bg-silver" },
  reminder: { label: "Recordatorio", dot: "bg-foreground" },
};

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  // Monday-first grid.
  const lead = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first.getTime() - lead * 86_400_000);
  const cells = Math.ceil((lead + last.getUTCDate()) / 7) * 7;
  const days = Array.from({ length: cells }, (_, i) => iso(new Date(gridStart.getTime() + i * 86_400_000)));
  return { from: iso(first), to: iso(last), prev, next, days, label: first };
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser("/app/calendar");
  const profile = await getProfile(user.id);
  const tz = profile?.timezone ?? "America/Lima";
  const today = todayIn(tz);
  const { month: raw } = await searchParams;
  const month = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : today.slice(0, 7);
  const b = monthBounds(month);

  const supabase = await createClient();
  const [events, reminders, { data: products }] = await Promise.all([
    getCalendarEvents(user.id, b.days[0]!, b.days[b.days.length - 1]!, tz),
    listUpcomingReminders(user.id, 25),
    supabase.from("products").select("id, name").eq("user_id", user.id).eq("status", "active").order("name").limit(500),
  ]);

  const byDay = new Map<string, typeof events>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const monthEvents = events.filter((e) => e.date >= b.from && e.date <= b.to);
  const monthName = new Intl.DateTimeFormat("es-PE", { month: "long", timeZone: "UTC" }).format(b.label);
  const title = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${b.label.getUTCFullYear()}`;
  const dayFmt = new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <>
      <PageHeader
        title="Calendario"
        description="Vencimientos, devoluciones, documentos y tus recordatorios."
        actions={<NewReminderButton products={products ?? []} tomorrow={todayIn(tz, 1)} />}
      />

      <div className="grid gap-8 xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-medium tracking-[-0.01em]">{title}</h2>
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" size="icon" aria-label="Mes anterior">
                <Link href={`/app/calendar?month=${b.prev}`}>
                  <ChevronLeft />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/app/calendar">Hoy</Link>
              </Button>
              <Button asChild variant="ghost" size="icon" aria-label="Mes siguiente">
                <Link href={`/app/calendar?month=${b.next}`}>
                  <ChevronRight />
                </Link>
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-border" role="group" aria-label={`Calendario de ${title}`}>
            <div className="grid grid-cols-7 gap-px" aria-hidden>
              {WEEKDAYS.map((d) => (
                <div key={d} className="bg-surface px-2 py-2 text-center text-[12px] text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {b.days.map((day) => {
                const items = byDay.get(day) ?? [];
                const inMonth = day >= b.from && day <= b.to;
                const isToday = day === today;
                return (
                  <div
                    key={day}
                    className={cn("min-h-16 bg-surface-raised p-1.5 sm:min-h-24 sm:p-2", !inMonth && "bg-surface text-muted-foreground")}
                  >
                    <span className="sr-only">
                      {dayFmt.format(new Date(`${day}T12:00:00Z`))}
                      {items.length ? `, ${items.length} ${items.length === 1 ? "evento" : "eventos"}` : ""}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-[12px] tabular-nums",
                        isToday && "bg-foreground font-medium text-background",
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {/* Mobile: dots. Desktop: labels. */}
                    <div className="mt-1 flex flex-wrap gap-1 sm:hidden" aria-hidden>
                      {items.slice(0, 4).map((e) => (
                        <span key={e.key} className={cn("size-1.5 rounded-full", KIND[e.kind].dot)} />
                      ))}
                    </div>
                    <ul className="mt-1 hidden gap-1 sm:grid">
                      {items.slice(0, 2).map((e) => (
                        <li key={e.key}>
                          <Link href={e.href} className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[12px] leading-tight hover:bg-muted" title={e.sharedBy ? `${e.title} (de ${e.sharedBy})` : e.title}>
                            <span className={cn("size-1.5 shrink-0 rounded-full", KIND[e.kind].dot)} aria-hidden />
                            <span className="truncate">{e.title}</span>
                          </Link>
                        </li>
                      ))}
                      {items.length > 2 && <li className="px-1 text-[12px] text-muted-foreground">+{items.length - 2} más</li>}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted-foreground">
            {Object.values(KIND).map((k) => (
              <span key={k.label} className="inline-flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", k.dot)} aria-hidden />
                {k.label}
              </span>
            ))}
          </div>

          <section aria-labelledby="agenda" className="mt-8">
            <h2 id="agenda" className="mb-3 font-medium">
              Este mes
            </h2>
            {monthEvents.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border-strong px-5 py-6 text-sm text-muted-foreground">
                Nada programado en {title}.
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-raised">
                {monthEvents.map((e) => (
                  <li key={e.key}>
                    <Link href={e.href} className="flex items-center gap-4 px-4 py-3 hover:bg-muted sm:px-5">
                      <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
                        {new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${e.date}T12:00:00Z`))}
                        {e.time && ` · ${e.time}`}
                      </span>
                      <span className={cn("size-2 shrink-0 rounded-full", KIND[e.kind].dot)} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{e.title}</span>
                      <span className="hidden text-[12px] text-muted-foreground sm:inline">
                        {e.sharedBy ? `${KIND[e.kind].label} de ${e.sharedBy}` : KIND[e.kind].label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside aria-labelledby="scheduled">
          <h2 id="scheduled" className="mb-3 font-medium">
            Avisos programados
          </h2>
          <ReminderList reminders={reminders} timeZone={tz} />
          <p className="mt-3 text-[13px] text-muted-foreground">
            Los avisos se envían desde nuestros servidores a las 9:00 de tu zona horaria, aunque no tengas ORVELIA abierto.{" "}
            <Link href="/app/settings#avisos" className="underline underline-offset-2 hover:text-foreground">
              Configurar avisos
            </Link>
          </p>
        </aside>
      </div>
    </>
  );
}
