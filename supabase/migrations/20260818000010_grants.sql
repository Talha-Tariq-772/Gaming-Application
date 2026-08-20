-- Postgres checks table-level GRANTs before RLS ever runs, and RLS
-- policies alone don't create access — service_role's BYPASSRLS only
-- skips row filtering, not this coarse-grained check. Tables created via
-- direct migration push don't automatically inherit the grants Supabase's
-- dashboard sets up for a project's initial schema, so they're made
-- explicit here.
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.profiles to anon;
grant all on public.profiles to service_role;

grant select, insert, update, delete on public.games to authenticated;
grant select on public.games to anon;
grant all on public.games to service_role;

grant select, insert, update, delete on public.payment_methods to authenticated;
grant select on public.payment_methods to anon;
grant all on public.payment_methods to service_role;

grant select, insert on public.orders to authenticated;
grant all on public.orders to service_role;

grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;

grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;

-- game_credentials: service_role only. anon/authenticated already have
-- nothing (see 20260818000004_game_credentials.sql); not granting them
-- anything here keeps it that way.
grant all on public.game_credentials to service_role;

grant execute on function public.generate_unique_payment_reference() to authenticated, service_role;
grant execute on function public.generate_unique_amount(numeric) to authenticated, service_role;
