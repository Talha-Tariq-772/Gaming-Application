-- The previous fix (20260819000003) only bypassed the admin-only check
-- when auth.role() = 'service_role' — i.e. our app's own service-role
-- client via PostgREST. But a direct connection (Supabase dashboard SQL
-- editor, psql, or the connection this migration pipeline itself uses)
-- carries no JWT/PostgREST context at all, so auth.role() there is NULL,
-- not 'service_role'. NULL = 'service_role' is NULL (not true), so the
-- bypass never actually fired for that path — leaving no way to promote
-- the very first admin from the dashboard.
--
-- Inverted: the admin-only check now runs ONLY when auth.role() =
-- 'authenticated' (a real signed-in end-user session, customer or staff,
-- making a request through our app's normal API surface). Every other
-- context — no JWT at all (dashboard/direct SQL), or 'service_role' —
-- passes through untouched. This keeps the original guarantee (a logged-
-- in customer can never self-promote through the app) while restoring
-- the ability to bootstrap/manage admins directly from the dashboard.
create or replace function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.role() = 'authenticated' then
      if public.current_profile_role() is distinct from 'admin' then
        raise exception 'Only admins can change role';
      end if;
    end if;
  end if;
  return new;
end;
$$;
