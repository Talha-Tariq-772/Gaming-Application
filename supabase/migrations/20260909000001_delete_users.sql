-- Backs the new admin "delete user" action (src/lib/actions/admin-users.ts's
-- deleteUser). Every FK pointing at profiles(id) — orders.user_id,
-- orders.reviewed_by, audit_log.actor_id, news_posts.author_id — has no ON
-- DELETE clause (RESTRICT/NO ACTION by default), and profiles.id itself
-- cascades from auth.users on delete. Net effect before this migration: a
-- real DELETE on a profile with any order/review/audit/news history was
-- already impossible (the cascade from auth.users would hit one of those
-- RESTRICT constraints and abort), but there was no way to remove a
-- genuinely empty account either, and no soft-delete path for the common
-- case of a customer with real order history.
--
-- deleted_at is the soft-delete marker: set instead of a real DELETE
-- whenever the profile has order/review/audit/news history, so that
-- history stays correctly attributed forever. A hard DELETE (via
-- auth.admin.deleteUser(id, false), which cascades through the FK above)
-- stays reserved for accounts with none of that — same reasoning as
-- deleteGame's order_items/game_credentials check.
alter table public.profiles add column deleted_at timestamptz;

-- current_profile_role() is the single choke point nearly every RLS policy
-- in this schema calls to decide admin/agent access (see the grep: games,
-- payment_methods, orders, order_items, audit_log, news_posts, setup_guides,
-- gift_cards, storage.objects, game_variants all key off it). Filtering out
-- a soft-deleted row here means a soft-deleted admin/agent loses every
-- privileged RLS grant app-wide the instant deleted_at is set, even if a
-- lingering session/JWT somehow survives the auth-layer ban this migration's
-- deleteUser action also applies — defense in depth, not the only layer.
create or replace function public.current_profile_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and deleted_at is null;
$$;

-- Same shape as prevent_last_active_variant_removal
-- (20260831000003_prevent_last_active_variant_removal.sql): one function
-- covering both the soft-delete path (UPDATE, deleted_at going from null to
-- non-null) and the hard-delete path (DELETE, including a DELETE reached via
-- auth.users' ON DELETE CASCADE into this table), sharing one errcode.
--
-- deleteUser's own admin-count check (isLastAdminRemoval, mirroring
-- isLastAdminDemotion) is advisory only — a SELECT-then-write with no
-- locking, same caveat as trg_prevent_last_admin_demotion's own doc comment.
-- This trigger is the real boundary: it locks every active admin row
-- (role='admin' and deleted_at is null) before counting, inside the same
-- transaction as the write, so two concurrent deletions of two different
-- admins can't both read a stale "2 admins" snapshot and both succeed.
--
-- Independent of trg_prevent_last_admin_demotion: that trigger blocks a
-- role change away from 'admin', this one blocks deleted_at being set (or
-- the row being removed outright) on a profile that's still role='admin' —
-- neither operation touches the other's condition, so they can't interfere.
create or replace function public.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_count integer;
begin
  if tg_op = 'DELETE' then
    if old.role is distinct from 'admin' or old.deleted_at is not null then
      return old;
    end if;
  else
    if old.role is distinct from 'admin' or old.deleted_at is not null or new.deleted_at is null then
      return new;
    end if;
  end if;

  -- Locks every currently-active admin row (the row being updated/deleted is
  -- itself one of them, since we only reach here when old.role='admin' and
  -- old.deleted_at is null — still present in the table at BEFORE-trigger
  -- time) before counting, same reasoning as trg_prevent_last_admin_demotion.
  perform 1 from public.profiles where role = 'admin' and deleted_at is null order by id for update;

  select count(*) into v_admin_count from public.profiles where role = 'admin' and deleted_at is null;

  if v_admin_count <= 1 then
    raise exception 'Cannot delete the last remaining admin'
      using errcode = 'LA002';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger trg_prevent_last_admin_soft_delete
  before update on public.profiles
  for each row execute function public.prevent_last_admin_removal();

create trigger trg_prevent_last_admin_hard_delete
  before delete on public.profiles
  for each row execute function public.prevent_last_admin_removal();
