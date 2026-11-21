import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sendEmail } from "@/lib/email";
import { publicEnv } from "@/lib/env";
import { sendPush, type PushMessage } from "@/lib/push";
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

  const summary = { processed: 0, emailed: 0, emailSkipped: 0, emailFailed: 0, retried: 0, errors: 0, pushed: 0, pushFailed: 0 };

  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data: due, error } = await admin.rpc("claim_due_reminders", { p_limit: BATCH });
    if (error) {
      console.error("[cron:reminders] claim failed", error);
      return NextResponse.json({ ...summary, error: "claim_failed" }, { status: 500 });
    }
    if (!due || due.length === 0) break;

    // Devices of the people in this batch that have push turned on.
    const userIds = [...new Set(due.map((r) => r.user_id))];
    const [{ data: tokens }, { data: prefs }] = await Promise.all([
      admin.from("push_tokens").select("user_id, token").in("user_id", userIds),
      admin.from("notification_preferences").select("user_id, push_enabled").in("user_id", userIds),
    ]);
    const pushOff = new Set((prefs ?? []).filter((p) => p.push_enabled === false).map((p) => p.user_id));
    const pushes: PushMessage[] = [];

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
      if (!(retry && r.attempts < 2) && !pushOff.has(r.user_id)) {
        const path = r.product_id ? `/products/${r.product_id}` : "/calendar";
        for (const t of tokens ?? []) {
          if (t.user_id === r.user_id) pushes.push({ to: t.token, title: r.title, body: r.description ?? undefined, data: { path } });
        }
      }
      if (retry && r.attempts < 2) summary.retried++;
      else if (emailStatus === "sent") summary.emailed++;
      else if (emailStatus === "skipped") summary.emailSkipped++;
      else if (emailStatus === "failed") summary.emailFailed++;
    }
    if (pushes.length) {
      const res = await sendPush(pushes);
      summary.pushed += res.sent;
      summary.pushFailed += res.failed;
      if (res.unregistered.length) await admin.from("push_tokens").delete().in("token", res.unregistered);
    }
    if (due.length < BATCH) break;
  }

  console.info("[cron:reminders]", summary);
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}
