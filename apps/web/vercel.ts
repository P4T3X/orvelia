import type { VercelConfig } from "@vercel/config/v1";

/**
 * Reminder delivery runs on a schedule on the server, never on browser timers.
 * Daily at 14:00 UTC = 09:00 in Lima (automatic reminders are timed for 09:00
 * local). Hobby plans allow one run per day; on Pro, switch to "0 * * * *" so
 * users in other time zones are notified at their 09:00 too.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export const config: VercelConfig = {
  framework: "nextjs",
  crons: [{ path: "/api/cron/reminders", schedule: "0 14 * * *" }],
};
