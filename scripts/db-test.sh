#!/usr/bin/env bash
# Runs every SQL test on its own fresh database: stub → migrations → test.
# A test passes when every ERROR it prints follows an "[expect FAIL" marker and
# every marker is followed by an ERROR. Also runs the security audit gate.
#
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres scripts/db-test.sh
set -euo pipefail
export PGOPTIONS='-c client_min_messages=warning'
cd "$(dirname "$0")/.."
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
fresh() {
  "${PSQL[@]}" -d postgres -c "drop database if exists $1 with (force)" -c "create database $1" >/dev/null
  "${PSQL[@]}" -d "$1" -f supabase/tests/ci/supabase-stub.sql >/dev/null
  for f in supabase/migrations/*.sql; do "${PSQL[@]}" -d "$1" --single-transaction -f "$f" >/dev/null; done
  "${PSQL[@]}" -d "$1" -c "insert into auth.users (id, email, raw_user_meta_data) values
    ('aaaaaaaa-1111-4111-8111-111111111111','ana.torres@example.com','{\"full_name\":\"Ana Torres\"}'),
    ('bbbbbbbb-2222-4222-8222-222222222222','otro@example.com','{\"full_name\":\"Otro Usuario\"}')" >/dev/null
}

fail=0
fresh orvelia_audit
if audit=$(PGOPTIONS='' "${PSQL[@]}" -d orvelia_audit -f supabase/tests/security_audit.sql 2>&1); then
  echo "PASS security_audit"
else
  echo "FAIL security_audit"; printf '%s\n' "$audit"; fail=1
fi

for t in supabase/tests/rls_smoke.sql supabase/tests/phase*.sql; do
  name=$(basename "$t" .sql)
  fresh orvelia_test
  out=$(psql -X -d orvelia_test -f "$t" 2>&1 || true)
  verdict=$(printf '%s\n' "$out" | awk '
    /\[expect FAIL/ { if (pending) { print "missing expected failure before line " NR } pending=1; next }
    /ERROR:/        { if (pending) { pending=0 } else { print "unexpected: " $0 } next }
    /\[expect /     { if (pending) { print "missing expected failure before line " NR; pending=0 } }
    END             { if (pending) { print "missing expected failure at end" } }')
  if [ -z "$verdict" ]; then echo "PASS $name"; else echo "FAIL $name"; printf '%s\n' "$verdict" | head -20; fail=1; fi
done
"${PSQL[@]}" -d postgres -c "drop database if exists orvelia_test with (force)" -c "drop database if exists orvelia_audit with (force)" >/dev/null
exit $fail
