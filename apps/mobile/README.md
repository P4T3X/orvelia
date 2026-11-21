# ORVELIA mobile (Expo)

iOS and Android app for ORVELIA, built with Expo SDK 58 and Expo Router. It uses
the same Supabase project as the web app (Row Level Security protects every
read and write) and calls the web app's `/api/mobile/*` endpoints for the parts
that run on the server: reading receipts with AI, confirming them, and the
assistant.

## What it does

- Sign in / create an account (e-mail and password).
- Home: active products, active warranties, plan, what's due in 30 days, items
  shared by the family, unread notices.
- Collection: search and filter; product detail with photo, purchase facts,
  warranties and returns, documents, status; add a product with a photo; add a
  warranty in two taps (6 months to 3 years).
- Scan: photograph a receipt, ORVELIA AI reads it, review and confirm; the
  checked items become products.
- Upcoming: the next 6 months by month, including family-shared dates.
- Notices, ORVELIA AI chat, read-only family products.
- Push notifications for reminders (Expo Push → APNs/FCM). Tapping one opens
  the product.

Account deletion is in the app (Ajustes → Eliminar mi cuenta). Subscriptions are
sold only on the web (Mercado Pago); the app shows the current plan and never
links to the purchase page, to stay within App Store and Play payment rules.
Family management and data export stay on the web (the app links to them).

## Run it

```bash
cp .env.example .env    # fill in the Supabase URL/anon key and the web app URL
pnpm --filter @orvelia/mobile start         # Expo dev server
```

Push notifications and the camera need a **development build**
(not Expo Go): `npx eas-cli@latest build --profile development`.

## Build and release

1. `npx eas-cli@latest init` (creates the EAS project; put its id in `EAS_PROJECT_ID`).
2. Push credentials: `eas credentials` → iOS push key (APNs) and Android FCM v1
   service account. Set `EXPO_ACCESS_TOKEN` on the web app if you enable
   enhanced push security.
3. `eas build --profile production --platform all`, then `eas submit`.
4. Store checklist: `../../docs/mobile/store-submission.md`.

## Tests

- `pnpm --filter @orvelia/mobile typecheck` and `test` (unit).
- End-to-end: the web build (`expo export --platform web`) is driven with
  Playwright against the API and a real Postgres (sign in, add a product with a
  photo, warranty, search, scan and confirm a receipt, upcoming, notices,
  assistant, sign out) plus push delivery from the reminders job.
- Native-only pieces (camera, push permission and delivery on real devices)
  must be checked on a phone with a development build before each release.
