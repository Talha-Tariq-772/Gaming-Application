-- order_id references orders(id), added as a FK once orders exists
-- (see 20260818000006_game_credentials_order_fk.sql) to break the
-- circular dependency between game_credentials and orders.
create table public.game_credentials (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id),
  login_enc bytea not null,
  password_enc bytea not null,
  status text not null default 'available' check (status in ('available', 'reserved', 'sold', 'revoked')),
  reserved_until timestamptz,
  order_id uuid,
  sold_at timestamptz,
  revealed_at timestamptz,
  revealed_ip text,
  notes text,
  created_at timestamptz not null default now()
);

-- Supports the reserve_credential() hot path: find the oldest available
-- credential for a game.
create index idx_game_credentials_game_status on public.game_credentials (game_id, status);

alter table public.game_credentials enable row level security;

-- Deliberately no policies of any kind for anon/authenticated. RLS enabled
-- with zero policies denies all access to every role except service_role,
-- which bypasses RLS entirely (BYPASSRLS). Revoking table grants too as
-- defense in depth, since GRANTs would otherwise permit rows-filtered-to-
-- zero queries rather than an outright permission error.
revoke all on public.game_credentials from anon, authenticated;
