# Beta program

## Feedback

Signed-in users send feedback from **Enviar comentarios** in the sidebar
(problem, idea or other, up to 2000 characters, 10 per person per day). Each
entry stores the page it was sent from. Users can read only their own entries;
the team reads them with the service role:

```sql
select f.created_at, f.kind, f.page, f.message, u.email
from public.feedback f join auth.users u on u.id = f.user_id
order by f.created_at desc limit 100;
```

Review it twice a week. Reply by e-mail to anyone who reports a problem.

## Suggested beta plan

1. **Closed beta (2–3 weeks, 20–50 people):** friends and family in Lima,
   Mercado Pago in test mode, all plans free. Goal: no blocking bugs in sign-up,
   adding products, scanning receipts and reminders.
2. **Open beta (4 weeks):** real payments on, invitation link on the landing
   page. Goal: first paying users, measure scan accuracy and AI cost per user.
3. **Launch:** see `launch-checklist.md`.

Track: sign-ups, activation (first product within 24 h), receipts scanned,
reminders delivered, weekly active users, conversion to Plus/Ultra, feedback by
type.
