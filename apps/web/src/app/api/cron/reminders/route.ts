import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sendEmail } from "@/lib/email";
import { publicEnv } from "@/lib/env";
import { reminderEmail } from "@/lib/reminder-email";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH = 50;
const MAX_BATCHES = 20;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/**
 * Delivers due reminders: claims them atomically in Postgres (safe to run
 * concurrently), sends email when requested and configured, then records the
 * outcome, which creates the in-app notification and the next occurrence of
 * recurring reminders.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, { status: 500 });

  const summary = { processed: 0, emailed: 0, emailSkipped: 0, emailFailed: 0, retried: 0, errors: 0 };

  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data: due, error } = await admin.rpc("claim_due_reminders", { p_limit: BATCH });
    if (error) {
      console.error("[cron:reminders] claim failed", error);
      return NextResponse.json({ ...summary, error: "claim_failed" }, { status: 500 });
    }
    if (!due || due.length === 0) break;

    for (const r of due) {
      let emailStatus: "sent" | "skipped" | "failed" | "not_requested" = "not_requested";
      let errorText: string | null = null;
      let retry = false;

      if (r.channels.includes("email") && r.email_enabled && r.email) {
        const path = r.product_id ? `/app/products/${r.product_id}` : r.source === "document" ? "/app/documents" : "/app/calendar";
        const res = await sendEmail({
          to: r.email,
          idempotencyKey: `reminder-${r.id}`,
          ...reminderEmail({ name: r.full_name, title: r.title, description: r.description, url: `${publicEnv.siteUrl}${path}` }),
        });
        emailStatus = res.status;
        if (res.status === "failed") {
          errorText = res.error;
          retry = res.transient;
        }
      }

      const { error: completeError } = await admin.rpc("complete_reminder", {
        p_id: r.id,
        p_email_status: emailStatus,
        p_error: errorText,
        p_retry: retry,
      });
      if (completeError) {
        summary.errors++;
        console.error("[cron:reminders] complete failed", { id: r.id, completeError });
        continue;
      }
      summary.processed++;
      if (retry && r.attempts < 2) summary.retried++;
      else if (emailStatus === "sent") summary.emailed++;
      else if (emailStatus === "skipped") summary.emailSkipped++;
      else if (emailStatus === "failed") summary.emailFailed++;
    }
    if (due.length < BATCH) break;
  }

  console.info("[cron:reminders]", summary);
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}
