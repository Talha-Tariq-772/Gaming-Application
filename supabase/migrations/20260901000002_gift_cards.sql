-- Gift cards: a second product type alongside games/game_credentials.
-- A gift card is a single redemption code, not a login pair — hence a
-- separate gift_card_codes table rather than reusing game_credentials'
-- login_enc/password_enc shape.
--
-- Scope of this migration: schema + RLS + the atomic reservation function
-- only. order_items/orders and create_order/approve_order/reject_order are
-- deliberately left untouched this session — gift cards are not yet
-- reachable through checkout.

-- title is not part of the original spec — added because every catalog
-- table in this schema (games.title, news_posts.title, setup_guides.title)
-- carries a human-readable name, and there is no way to render a card
-- heading, <title>/alt text, or admin list row without one that isn't
-- either hardcoded or a robotic "PSN Gift Card — US — $10" string
-- generated from the enum columns.
create table public.gift_card_products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  platform text not null check (platform in ('psn', 'xbox', 'steam', 'google_play', 'apple')),
  region text not null check (region in ('US', 'UK', 'EU', 'TR', 'PK', 'GLOBAL')),
  denomination_value numeric,
  denomination_currency text,
  price_pkr integer not null check (price_pkr > 0),
  card_image_url text,
  header_image_url text,
  description text,
  redemption_instructions text,
  is_active boolean not null default false,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- code_hash is not part of the original spec — added because AES-256-GCM
-- (lib/crypto.ts) uses a random IV per call, so two encryptions of the
-- same plaintext code never produce the same ciphertext. Admin CSV bulk
-- upload (a later session) needs to reject duplicate codes without
-- decrypting every existing row on every upload; a SHA-256 hash of the
-- trimmed plaintext, with a unique index, gives that for free via a normal
-- Postgres unique-violation.
create table public.gift_card_codes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.gift_card_products (id),
  code_encrypted text not null,
  code_hash text not null,
  status text not null default 'available' check (status in ('available', 'reserved', 'delivered', 'void')),
  reserved_at timestamptz,
  order_id uuid references public.orders (id),
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_gift_card_codes_product_status on public.gift_card_codes (product_id, status);
create unique index idx_gift_card_codes_code_hash on public.gift_card_codes (code_hash);

-- RLS: mirrors games_select / games_admin_* exactly
-- (supabase/migrations/20260818000002_games.sql).
alter table public.gift_card_products enable row level security;

create policy "gift_card_products_select" on public.gift_card_products
  for select
  using (is_active = true or public.current_profile_role() = 'admin');

create policy "gift_card_products_admin_insert" on public.gift_card_products
  for insert
  with check (public.current_profile_role() = 'admin');

create policy "gift_card_products_admin_update" on public.gift_card_products
  for update
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

create policy "gift_card_products_admin_delete" on public.gift_card_products
  for delete
  using (public.current_profile_role() = 'admin');

-- RLS: mirrors game_credentials exactly
-- (supabase/migrations/20260818000004_game_credentials.sql) — RLS enabled
-- with zero policies, plus an explicit revoke, denies every role except
-- service_role (which bypasses RLS entirely). There is no "owning user"
-- RLS policy here, same as game_credentials: owner access to a code after
-- delivery is enforced entirely in application code (a future
-- revealGiftCardCode server action using the service-role client), never
-- by a row-level policy.
alter table public.gift_card_codes enable row level security;
revoke all on public.gift_card_codes from anon, authenticated;

grant select on public.gift_card_products to anon;
grant select, insert, update, delete on public.gift_card_products to authenticated;
grant all on public.gift_card_products to service_role;
grant all on public.gift_card_codes to service_role;

-- Atomic reservation — same FOR UPDATE SKIP LOCKED shape as
-- reserve_credential (supabase/migrations/20260818000009_functions.sql),
-- table/column names swapped. Not yet called from anywhere (create_order
-- is untouched this session); it exists so concurrent-reservation
-- behavior can be exercised/tested independently of checkout.
create or replace function public.reserve_gift_card_code(p_product_id uuid, p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code_id uuid;
begin
  select id into v_code_id
  from public.gift_card_codes
  where product_id = p_product_id and status = 'available'
  order by created_at
  limit 1
  for update skip locked;

  if v_code_id is null then
    return null;
  end if;

  update public.gift_card_codes
  set status = 'reserved',
      reserved_at = now(),
      order_id = p_order_id
  where id = v_code_id;

  return v_code_id;
end;
$$;

revoke all on function public.reserve_gift_card_code(uuid, uuid) from public;
grant execute on function public.reserve_gift_card_code(uuid, uuid) to service_role;
