import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Rows = Promise<{ data: unknown[] | null; error: { message: string } | null }>;
/** The export reads tables generically; rows go straight to JSON, so no row types are needed. */
const untyped = (c: unknown) => c as { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => Rows } } };

/** Tables exported for the signed-in user (RLS limits every read to their own rows). */
const OWN_TABLES = [
  "categories",
  "products",
  "receipts",
  "documents",
  "warranties",
  "return_deadlines",
  "maintenance_plans",
  "maintenance_logs",
  "reminders",
  "notifications",
  "notification_preferences",
  "subscriptions",
  "billing_checkouts",
  "ai_usage",
  "feedback",
] as const;

/**
 * "Descargar mis datos": everything ORVELIA stores about the user as JSON
 * (right of access, Ley 29733). Files are listed by path; each one can be
 * downloaded from the app while the account exists.
 */
export async function GET() {
  const user = await getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const supabase = await createClient();

  const [profile, family, ...rows] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.rpc("family_overview"),
    ...OWN_TABLES.map((t) => untyped(supabase).from(t).select("*").eq("user_id", user.id)),
  ]);
  const failed = [profile, ...rows].find((r) => r.error);
  if (failed?.error) {
    console.error("[export] failed", failed.error.message);
    return new NextResponse("No pudimos preparar tu exportación. Inténtalo de nuevo.", { status: 500 });
  }

  const data: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    format: "orvelia-export/1",
    account: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profile.data,
    family: family.data ?? null,
  };
  OWN_TABLES.forEach((t, i) => (data[t] = rows[i]?.data ?? []));

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="orvelia-mis-datos-${date}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
