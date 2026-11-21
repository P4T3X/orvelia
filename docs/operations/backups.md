# Backups and restore

ORVELIA keeps two independent copies of the database. File contents (photos,
receipts, documents) live in Supabase Storage and need their own policy (below).

## 1. Supabase managed backups (primary)

- **Plan:** Supabase Pro or higher. Daily backups are kept 7 days on Pro.
- **Point-in-time recovery (PITR):** enable the add-on before launch. It allows
  restoring to any second within the retention window (recommended: 7 days).
- **Where:** Dashboard → Database → Backups.
- **Who can restore:** project owners only. Restoring replaces the database;
  announce a maintenance window first.

## 2. Encrypted logical backup (secondary, off-platform)

`scripts/backup-db.sh` dumps the `public`, `auth` and `storage` schemas with
`pg_dump` (custom format) and encrypts the file with AES-256 (gpg).

```bash
SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
BACKUP_PASSPHRASE="<from the password manager>" \
scripts/backup-db.sh ./backups
```

- Run it weekly (and before every risky migration). Keep 8 weekly copies.
- Store the files outside Supabase and Vercel (for example an encrypted bucket
  with versioning in another provider). The passphrase lives only in the team's
  password manager, never next to the files.
- The dump contains personal data. Treat it like the production database.

## 3. Restore drill (do it once before launch, then every quarter)

Restore into a scratch Postgres 16, never into production:

```bash
createdb restore_drill
psql -d restore_drill -c "create schema if not exists extensions; create role anon; create role authenticated; create role service_role bypassrls;"
gpg --batch --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" -d orvelia-YYYYMMDD-HHMM.dump.gpg \
  | pg_restore --no-owner --no-privileges -d restore_drill
psql -d restore_drill -c "select count(*) from auth.users; select count(*) from public.products;"
```

`schema "public" already exists` is expected. Compare the counts with
production. Last drill (local, 2026-11-21): every table restored with matching
row counts and all 46 RLS policies.

## 4. Files in Storage

Supabase backups do **not** include Storage objects. Options, in order of effort:

1. Rely on the user's own copies plus the in-app export (low effort, some risk).
2. A scheduled job that mirrors the `user-files` bucket to a versioned bucket in
   another provider (recommended once there are paying users).

Deleting an account removes its files immediately; backups older than the
retention window age out on their own.
