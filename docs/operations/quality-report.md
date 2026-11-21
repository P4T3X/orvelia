# Quality report — Phase 8 (2026-11-21)

Measured on a local production build (`next build && next start`) against the
test harness (real PostgreSQL 16 with the RLS policies, emulated Supabase APIs).
Re-run before launch against the preview deployment.

## Security
- `supabase/tests/security_audit.sql`: all 8 checks pass (RLS on every table,
  pinned `search_path` on definer functions, nothing definer callable by `anon`
  except `invitation_preview`, trigger functions not callable, no anon policies
  except the price list, foreign keys indexed). It caught and the Phase 8
  migration fixed: 5 functions callable by `anon` and 9 unindexed foreign keys.
- `pnpm audit --prod`: no known vulnerabilities.
- Content-Security-Policy on every response (no `unsafe-eval`; `frame-ancestors
  'none'`; `object-src 'none'`). Zod runs jitless so the policy holds; no CSP
  violations on any page.
- Row-level security tests for every phase run in CI on fresh databases
  (`scripts/db-test.sh`): 9 of 9 pass.

## Accessibility (axe-core 4, WCAG 2.0/2.1/2.2 A and AA)
- 28 pages × light and dark × desktop (1440 px) and mobile (390 px): **0 violations**.
- Fixed in this phase: calendar grid ARIA roles and day labels, low-contrast
  out-of-month days, gold text on tinted badges (accent text darkened to ≥ 5:1).
- Still to do by hand before launch: a screen-reader pass (VoiceOver on iOS,
  TalkBack on Android) on sign-up, adding a product and the scanner.

## Performance (Lighthouse 12)
| Page | Mobile perf | Desktop perf | LCP mobile | TBT mobile | CLS | A11y | Best practices |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 95 | 100 | 2.9 s | 100 ms | 0 | 100 | 100 |
| `/pricing` | 94 | 100 | 3.0 s | 110 ms | 0 | 100 | 100 |
| `/login` | 84 | 100 | 2.9 s | 430 ms | 0 | 100 | 100 |
| `/app` | 88 | 100 | 3.6 s | 180 ms | 0 | 100 | 100 |
| `/app/products` | 89 | 100 | 3.3 s | 190 ms | 0 | 100 | 100 |
| `/app/analytics` | 97 | 100 | 2.1 s | 160 ms | 0 | 100 | 100 |
| `/app/family` | 91 | 100 | 2.9 s | 230 ms | 0 | 100 | 100 |

Mobile figures use Lighthouse's simulated slow 4G and vary about ±8 points between runs (`/login` scored 92 on an earlier run). SEO is 100 on public pages;
app pages are `noindex` on purpose. Server response time was ~50 ms locally;
in production expect the Lima ↔ São Paulo round trip on top.

## End-to-end
Playwright suites for phases 2–8: 35 + 38 + 29 + 20 + 20 + 34 + 22 checks, all passing.
