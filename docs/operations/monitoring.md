# Monitoring

## Health check

`GET /api/health` returns `{ status, db, latencyMs, release }` with HTTP 200, or
503 when the database can't be reached. It never exposes configuration values.
With `Authorization: Bearer $CRON_SECRET` it also reports which integrations are
configured (booleans only).

Point an uptime monitor at it every minute (Better Stack, UptimeRobot or Vercel
Checks) and alert on two consecutive failures.

## Server errors

`src/instrumentation.ts` logs every uncaught server error as one JSON line with
`"source":"orvelia"`, the route, the error digest and the release. The digest is
the code users see on the error screen, so a support message can be matched to
the log line.

- **Vercel → Logs:** filter `source:orvelia level:error`.
- **Alerts:** add a log drain (Better Stack, Datadog or Axiom) and alert when
  more than 5 errors arrive in 5 minutes.

## Jobs and integrations to watch

| What | Where to look | Alert when |
| --- | --- | --- |
| Reminder cron (`/api/cron/reminders`, daily 14:00 UTC) | Vercel → Cron Jobs | a run fails or takes > 60 s |
| Reminder delivery | `reminders.status = 'failed'` (see `last_error`) | more than 10 a day |
| Mercado Pago webhooks | `billing_events.processed_at is null` older than 1 h | any |
| AI usage and cost | `ai_usage`, Vercel AI Gateway dashboard | spend above the monthly budget |
| Database | Supabase → Reports | CPU > 80 % or disk > 80 % |

Useful queries (service role, SQL editor):

```sql
-- Webhooks not processed after an hour
select provider, type, event_id, received_at, error from billing_events
where processed_at is null and received_at < now() - interval '1 hour';

-- Reminders that failed in the last day
select count(*), max(last_error) from reminders where status = 'failed' and updated_at > now() - interval '1 day';
```
