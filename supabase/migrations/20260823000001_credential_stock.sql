-- Aggregate per-game credential counts, computed DB-side rather than
-- pulling every game_credentials row (game_id + status only, never the
-- encrypted payload) back to pull counts client-side. Admin-only surface
-- (via requireAdmin() in the calling action) — this function itself is
-- reachable only by service_role, same as everything else touching
-- game_credentials.
create or replace function public.get_credential_stock()
returns table (game_id uuid, available bigint, reserved bigint, sold bigint, revoked bigint)
language sql
security definer
stable
set search_path = public
as $$
  select
    game_id,
    count(*) filter (where status = 'available') as available,
    count(*) filter (where status = 'reserved') as reserved,
    count(*) filter (where status = 'sold') as sold,
    count(*) filter (where status = 'revoked') as revoked
  from public.game_credentials
  group by game_id;
$$;

revoke all on function public.get_credential_stock() from public;
grant execute on function public.get_credential_stock() to service_role;
