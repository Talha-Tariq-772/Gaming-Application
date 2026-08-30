-- game_variants is the single source of truth for price, in BOTH
-- variant_mode values. variant_mode='single' means "exactly one active
-- variant, render a price not a picker" — it does NOT mean price lives on
-- the games row. games.price is left in place (see below) but is no
-- longer authoritative as of this migration.
create table public.game_variants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  label text not null,
  price_pkr integer not null check (price_pkr > 0),
  was_price_pkr integer check (was_price_pkr is null or was_price_pkr > price_pkr),
  price_source text not null default 'estimate' check (price_source in ('catalog', 'estimate')),
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  -- One label per game (e.g. one "Standard"), and lets seed/backfill
  -- inserts use ON CONFLICT for idempotent re-runs.
  unique (game_id, label)
);

create index idx_game_variants_game_id on public.game_variants (game_id);

alter table public.game_variants enable row level security;

create policy "game_variants_select" on public.game_variants
  for select
  using (is_active = true);

create policy "game_variants_admin_all" on public.game_variants
  for all
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

grant select, insert, update, delete on public.game_variants to authenticated;
grant select on public.game_variants to anon;
grant all on public.game_variants to service_role;

-- Backfill: every pre-existing game (any row already in `games` before this
-- migration ran) gets exactly one 'Standard' variant carrying its current
-- price. price_source is 'estimate' here — a bare price on the old column
-- has no recorded provenance, unlike the catalog-confirmed seed data added
-- in 20260829000004_seed_catalog.sql. Dropping games.price is a separate,
-- riskier change (order_items/create_order() still read it directly) — not
-- done in this session.
insert into public.game_variants (game_id, label, price_pkr, price_source)
select g.id, 'Standard', round(g.price)::integer, 'estimate'
from public.games g
where not exists (select 1 from public.game_variants v where v.game_id = g.id);

alter table public.game_credentials add column variant_id uuid references public.game_variants (id);

comment on column public.game_credentials.variant_id is
  'Which variant this credential was provisioned for. Additive only this session: reserve_credential() (20260818000009_functions.sql) still selects purely by game_id and does not filter or set this column yet.';

-- Backfill: 1:1 join is only safe where a game currently has exactly one
-- variant. True for every game the insert above just touched (each got
-- exactly one), and for every game seeded in 20260829000004_seed_catalog.sql
-- except gta-vi (variant_mode='multi', no legacy credentials to backfill
-- anyway since it's a brand-new row). The extra count(*) = 1 guard makes
-- that assumption explicit instead of relying on migration ordering alone.
update public.game_credentials gc
set variant_id = v.id
from public.game_variants v
where gc.game_id = v.game_id
  and gc.variant_id is null
  and (select count(*) from public.game_variants v2 where v2.game_id = gc.game_id) = 1;
