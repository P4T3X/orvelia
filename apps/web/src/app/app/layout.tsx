import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { getProfile, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { default: "Mi espacio", template: "%s · ORVELIA" },
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate: re-verifies the session with Supabase Auth on every request.
  const user = await requireUser("/app");
  const supabase = await createClient();
  const [profile, { count: unread }] = await Promise.all([
    getProfile(user.id),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
  ]);

  return (
    <AppShell
      unread={unread ?? 0}
      user={{
        name: profile?.full_name || user.email?.split("@")[0] || "Tu cuenta",
        email: user.email ?? "",
      }}
    >
      {children}
    </AppShell>
  );
}
