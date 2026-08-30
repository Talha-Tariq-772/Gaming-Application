-- changeUserRole (src/lib/actions/admin-users.ts) already has an app-level
-- last-admin guardrail: read count(*) where role='admin', block the demotion
-- if count <= 1. That check is advisory only — it runs as a separate SELECT
-- before the UPDATE, with no locking, so it does not actually stop the
-- database from reaching zero admins. Two real ways it fails:
--
--   1. Any stray row with role='admin' (a forgotten account, a leaked test
--      row that was never cleaned up) inflates the count and can talk the
--      guardrail into allowing the TRUE last admin to be demoted.
--   2. Two concurrent demotions of two different admins (only two admins
--      exist) can both read count=2 before either writes, both pass the
--      check, and both succeed — leaving zero admins. A read-then-write
--      race, not a data problem.
--
-- This migration moves the actual boundary into the database, the same way
-- trg_prevent_role_change (20260818000001_profiles.sql) already enforces
-- "only an admin can change any role" as a trigger rather than trusting
-- every caller to re-check it. A BEFORE UPDATE trigger fires inside the same
-- transaction as the write itself and can lock rows before counting, which
-- an app-level SELECT-then-UPDATE across two round trips cannot do.
--
-- This does NOT replace the app-level check in changeUserRole — that stays,
-- and stays useful: it gives a fast, friendly rejection without ever
-- reaching the database in the common case. This trigger is the real
-- boundary that holds even when the app-level check is fooled (stray row)
-- or raced (concurrent demotions); changeUserRole is updated separately to
-- recognize this trigger's error and turn it into the same friendly
-- LAST_ADMIN result instead of a raw Postgres error.
create or replace function public.prevent_last_admin_demotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_count integer;
begin
  if old.role = 'admin' and new.role is distinct from 'admin' then
    -- Lock every admin row before counting. If a concurrent transaction is
    -- also demoting a different admin, its own UPDATE has already taken an
    -- exclusive lock on that other row before this trigger runs (Postgres
    -- locks the target row prior to firing BEFORE ROW triggers on it) — so
    -- this SELECT blocks until that transaction commits or rolls back, then
    -- sees its committed result. That serializes the two demotions instead
    -- of letting both read a stale "2 admins" snapshot and both proceed.
    perform 1 from public.profiles where role = 'admin' order by id for update;

    select count(*) into v_admin_count from public.profiles where role = 'admin';

    if v_admin_count <= 1 then
      raise exception 'Cannot demote the last remaining admin'
        using errcode = 'LA001';
    end if;
  end if;

  return new;
end;
$$;

-- Independent of trg_prevent_role_change (20260818000001_profiles.sql):
-- that trigger checks who the ACTOR is, this one checks the resulting admin
-- count, and neither depends on the other's outcome. Postgres fires
-- same-event BEFORE ROW triggers on a table in trigger-name alphabetical
-- order, which happens to run this one first here — harmless, since
-- changeUserRole (the only caller of an actual role-lowering UPDATE today)
-- already verifies the actor is a real admin via requireAdmin() before ever
-- reaching the database, so trg_prevent_role_change's own check is not
-- expected to fire in that path regardless of ordering.
create trigger trg_prevent_last_admin_demotion
  before update on public.profiles
  for each row execute function public.prevent_last_admin_demotion();
