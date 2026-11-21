#!/usr/bin/env bash
# Encrypted logical backup of the ORVELIA database: the app schema (public), user
# accounts (auth) and file metadata (storage). It complements Supabase's managed
# daily backups / PITR; file contents live in Storage and are not included.
#
#   SUPABASE_DB_URL="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres" \
#   BACKUP_PASSPHRASE="..." scripts/backup-db.sh [output-dir]
#
# Produces orvelia-YYYYMMDD-HHMM.dump.gpg (pg_dump custom format, AES256).
# Restore: see docs/operations/backups.md.
set -euo pipefail
: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL}"
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE}"
out_dir="${1:-.}"
stamp=$(date -u +%Y%m%d-%H%M)
file="$out_dir/orvelia-$stamp.dump.gpg"
mkdir -p "$out_dir"
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges --schema=public --schema=auth --schema=storage \
  | gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" \
        --symmetric --cipher-algo AES256 -o "$file"
echo "$file ($(du -h "$file" | cut -f1))"
