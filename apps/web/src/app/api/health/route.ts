import { NextResponse, type NextRequest } from "next/server";
import { isBillingConfigured } from "@/lib/billing";
import { isEmailConfigured } from "@/lib/email";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Uptime check. Public response: { status, db, latency } only. With
 * `Authorization: Bearer $CRON_SECRET` it also reports which integrations are
 * configured (booleans, never values).
 */
export async function GET(req: NextRequest) {
  const started = Date.now();
  let db: "ok" | "down" | "unconfigured" = "unconfigured";
  if (isSupabaseConfigured()) {
    try {
      const res = await fetch(`${publicEnv.supabaseUrl}/rest/v1/plan_limits?select=plan&limit=1`, {
        headers: { apikey: publicEnv.supabaseAnonKey, Authorization: `Bearer ${publicEnv.supabaseAnonKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      db = res.ok ? "ok" : "down";
    } catch {
      db = "down";
    }
  }
  const body: Record<string, unknown> = {
    status: db === "ok" ? "ok" : "degraded",
    db,
    latencyMs: Date.now() - started,
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  };
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) {
    body.config = {
      supabase: isSupabaseConfigured(),
      serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      email: isEmailConfigured(),
      payments: isBillingConfigured(),
      ai: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
      cron: true,
    };
  }
  return NextResponse.json(body, {
    status: db === "down" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
