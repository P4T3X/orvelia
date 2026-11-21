#!/usr/bin/env node
/**
 * Applies pending SQL migrations in supabase/migrations to the project's
 * Supabase database. Runs automatically in Vercel production builds (see
 * apps/web/package.json "build"); elsewhere it does nothing unless
 * ORVELIA_MIGRATE=1 is set.
 *
 * - Uses the same history table as the Supabase CLI
 *   (supabase_migrations.schema_migrations), so `supabase db push` stays in sync.
 * - Each migration runs in its own transaction; a failure stops the build.
 * - Afterwards it backfills profiles/subscriptions for accounts created
 *   before the schema existed.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const shouldRun = process.env.ORVELIA_MIGRATE === "1" || process.env.VERCEL_ENV === "production";
if (!shouldRun) {
  console.log("[migrate] skipped (not a production build)");
  process.exit(0);
}

const candidates = [process.env.POSTGRES_URL_NON_POOLING, process.env.POSTGRES_URL].filter(Boolean);
if (candidates.length === 0) {
  console.log("[migrate] skipped: POSTGRES_URL is not set");
  process.exit(0);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

function connect(url) {
  const u = new URL(url);
  const socketDir = u.searchParams.get("host"); // local testing: ?host=/socket/dir
  return postgres({
    ...(socketDir?.startsWith("/") ? { path: `${socketDir}/.s.PGSQL.${u.port || 5432}` } : {}),
    host: u.hostname,
    port: Number(u.port || 5432),
    database: decodeURIComponent(u.pathname.slice(1) || "postgres"),
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: process.env.PGSSLMODE === "disable" ? false : "require",
    prepare: false,
    max: 1,
    connect_timeout: 15,
    onnotice: () => {},
  });
}

async function open() {
  let lastError;
  for (const url of candidates) {
    const sql = connect(url);
    try {
      await sql`select 1`;
      console.log(`[migrate] connected to ${new URL(url).hostname}`);
      return sql;
    } catch (error) {
      lastError = error;
      await sql.end({ timeout: 1 }).catch(() => {});
    }
  }
  throw lastError;
}

const sql = await open();
try {
  await sql.unsafe(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `);
  const applied = new Set(
    (await sql`select version from supabase_migrations.schema_migrations`).map((r) => r.version),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  let count = 0;
  for (const file of files) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    if (applied.has(version)) continue;
    const body = await readFile(path.join(dir, file), "utf8");
    console.log(`[migrate] applying ${file}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into supabase_migrations.schema_migrations (version, name) values (${version}, ${rest.join("_")})`;
    });
    count += 1;
  }

  // Accounts created before the schema (and its auth trigger) existed.
  const backfilled = await sql`
    with p as (
      insert into public.profiles (id, full_name)
      select u.id, nullif(left(trim(u.raw_user_meta_data ->> 'full_name'), 120), '')
      from auth.users u
      where not exists (select 1 from public.profiles x where x.id = u.id)
      returning id
    )
    insert into public.subscriptions (user_id, plan, status, provider)
    select p.id, 'free', 'active', 'none' from p
    where not exists (select 1 from public.subscriptions s where s.user_id = p.id)
    returning user_id`;

  console.log(`[migrate] done: ${count} applied, ${files.length - count} already up to date, ${backfilled.length} accounts backfilled`);
} finally {
  await sql.end({ timeout: 5 });
}
