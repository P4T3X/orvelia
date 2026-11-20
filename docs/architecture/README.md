# Architecture

```
orvelia/
├─ apps/
│  └─ web/                 Next.js 16 (App Router, React 19, TS strict, Tailwind v4)
│     └─ src/
│        ├─ app/
│        │  ├─ (marketing)/    Public site: /, /features, /pricing, /about, /privacy, /terms
│        │  ├─ (auth)/         /login, /register, /forgot-password, /reset-password
│        │  ├─ auth/           Route handlers: /auth/confirm (email links), /auth/signout
│        │  └─ app/            Authenticated area (/app/*), server-gated
│        ├─ components/        ui/ (design-system primitives), brand/, marketing/, app/, auth/
│        ├─ lib/supabase/      Browser + server clients, proxy session refresh, DB types
│        └─ proxy.ts           Session refresh + route gating (Next 16 "proxy", formerly middleware)
├─ packages/
│  ├─ domain/              Framework-free domain constants (statuses, plans, verification)
│  └─ schemas/             Zod schemas shared by client, server and future mobile app
├─ supabase/
│  ├─ migrations/          SQL migrations (RLS on every table)
│  └─ tests/               SQL smoke tests for RLS
└─ docs/                   architecture, database, security, product
```

## Decisions

- **pnpm workspaces, no Turborepo yet.** Two shared packages don't justify a
  build orchestrator. Add it when `apps/mobile` arrives.
- **Shared packages ship TypeScript source** and are compiled by the consumer
  (`transpilePackages` in Next; Metro/Expo later). No build step to maintain.
- **Business rules stay out of components.** Validation lives in
  `@orvelia/schemas`, constants in `@orvelia/domain`, data access in server
  actions / server components. The future Expo app reuses the first two.
- **Server is the authority.** Auth, authorization and limits are enforced in
  Postgres (RLS) and server code; client state is never trusted.
- **Supabase SSR cookies** via `@supabase/ssr`; a new server client per request.
- **Copy is Spanish (es-PE)** for the initial market. Strings will move to a
  message catalog when English is added.
- **AI layer** (Phase 3+) will be a provider-independent interface in a new
  `packages/ai` with Zod-validated outputs; no provider is hard-coded.
