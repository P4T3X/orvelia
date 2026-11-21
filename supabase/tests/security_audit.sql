-- Security audit gate. Raises an exception (non-zero exit with ON_ERROR_STOP) if any
-- rule is broken. Run after applying every migration:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security_audit.sql
do $$
declare
  bad text;
begin
  -- 1. Every table in public has RLS enabled.
  select string_agg(c.relname, ', ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  if bad is not null then raise exception 'RLS disabled on: %', bad; end if;

  -- 2. Tables with RLS but no policies are server-only by design; keep the list explicit.
  select string_agg(c.relname, ', ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
     and c.relname not in ('billing_events', 'family_invitations');
  if bad is not null then raise exception 'Tables without policies (add policies or allow-list): %', bad; end if;

  -- 3. Security-definer functions pin search_path.
  select string_agg(p.proname, ', ') into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  if bad is not null then raise exception 'SECURITY DEFINER without search_path: %', bad; end if;

  -- 4. Anonymous visitors can call only the allow-listed definer function.
  select string_agg(p.proname, ', ') into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('invitation_preview');
  if bad is not null then raise exception 'SECURITY DEFINER callable by anon: %', bad; end if;

  -- 5. Trigger functions are not callable through the API.
  select string_agg(p.proname, ', ') into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
  if bad is not null then raise exception 'Trigger functions callable by clients: %', bad; end if;

  -- 6. Policies for anon (or PUBLIC) only on the public price list.
  select string_agg(tablename || '.' || policyname, ', ') into bad
    from pg_policies
   where schemaname = 'public' and (roles @> '{public}' or roles @> '{anon}') and tablename <> 'plan_limits';
  if bad is not null then raise exception 'Policies open to anon/public: %', bad; end if;

  -- 7. No write policy is open to anon.
  select string_agg(tablename || '.' || policyname, ', ') into bad
    from pg_policies
   where schemaname = 'public' and cmd <> 'SELECT' and (roles @> '{public}' or roles @> '{anon}');
  if bad is not null then raise exception 'Write policies open to anon/public: %', bad; end if;

  -- 8. Foreign keys are indexed (leading column of some index).
  select string_agg(c.conrelid::regclass || '.' || c.conname, ', ') into bad
    from pg_constraint c
   where c.contype = 'f' and c.connamespace = 'public'::regnamespace
     and not exists (
       select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0] = any (c.conkey)
          and (array_length(c.conkey, 1) = 1
               or (i.indkey::int2[])[1] = any (c.conkey)
               or (select a.attname from pg_attribute a where a.attrelid = c.conrelid and a.attnum = (i.indkey::int2[])[0]) <> 'user_id'));
  if bad is not null then raise exception 'Unindexed foreign keys: %', bad; end if;

  raise notice 'security audit: all checks passed';
end;
$$;
