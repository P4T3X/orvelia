import { Bell, Mail, MailX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { MarkRead } from "@/components/calendar/mark-read";
import { getProfile, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Avisos" };

const EMAIL_NOTE = {
  sent: { icon: Mail, text: "También enviado por correo" },
  failed: { icon: MailX, text: "No se pudo enviar el correo" },
  skipped: { icon: MailX, text: "Correo no configurado" },
  not_requested: null,
} as const;

export default async function NotificationsPage() {
  const user = await requireUser("/app/notifications");
  const supabase = await createClient();
  const [profile, { data, error }] = await Promise.all([
    getProfile(user.id),
    supabase
      .from("notifications")
      .select("id, title, body, link, email_status, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (error) throw new Error(`No se pudieron cargar los avisos: ${error.message}`);
  const items = data ?? [];
  const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
  const fmt = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: profile?.timezone ?? "America/Lima" });

  return (
    <>
      <PageHeader title="Avisos" description="Lo que ORVELIA te recordó, en un solo lugar." />
      {unreadIds.length > 0 && <MarkRead ids={unreadIds} />}
      {items.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border-strong px-6 py-14 text-center">
          <Bell className="mx-auto size-6 text-muted-foreground" aria-hidden strokeWidth={1.5} />
          <h2 className="mt-4 font-medium">Aún no tienes avisos</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Cuando se acerque el vencimiento de una garantía, un plazo de devolución o un recordatorio, lo verás aquí.
          </p>
        </section>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-raised">
          {items.map((n) => {
            const note = EMAIL_NOTE[n.email_status];
            const content = (
              <>
                <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-accent")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn("block leading-snug", !n.read_at && "font-medium")}>{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span>}
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 text-[12px] text-muted-foreground">
                    <span>{fmt.format(new Date(n.created_at))}</span>
                    {note && (
                      <span className="inline-flex items-center gap-1">
                        <note.icon className="size-3" aria-hidden />
                        {note.text}
                      </span>
                    )}
                  </span>
                </span>
                {!n.read_at && <span className="sr-only">(sin leer)</span>}
              </>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className="flex gap-3 px-4 py-4 hover:bg-muted sm:px-5">
                    {content}
                  </Link>
                ) : (
                  <div className="flex gap-3 px-4 py-4 sm:px-5">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
