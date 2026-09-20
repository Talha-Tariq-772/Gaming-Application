-- Cost-price tracking and profit reporting.
--
-- Three separate concerns, deliberately kept apart:
--   1. games.cost_price / game_variants.cost_price — what a unit costs US
--      *right now*. Mutable; the admin form edits it directly.
--   2. cost_price_history — every value that column has ever held, with the
--      date it took effect. Cost changes over time (supplier price moves),
--      so "what did this cost in March?" can't be answered from (1) alone.
--   3. order_items.cost_price — the value locked in at approval time. Once
--      written it is never recalculated, so an approved order's profit is
--      immune to any later cost change. This is what every profit figure
--      is computed from; (1) and (2) are only ever inputs to the lock.
--
-- PRIVACY: cost price must never reach a public response. Enforcement is
-- column-level below, not just convention — see the lockdown block.

-- ---------------------------------------------------------------------
-- 1. Current cost on the product and its variants
-- ---------------------------------------------------------------------

alter table public.games
  add column cost_price numeric(10, 2) check (cost_price is null or cost_price >= 0);

alter table public.game_variants
  add column cost_price numeric(10, 2) check (cost_price is null or cost_price >= 0);

comment on column public.games.cost_price is
  'Current unit cost to us, in PKR. NULL = not yet recorded (profit reports count these separately rather than assuming zero). Never exposed to anon/authenticated — see the column-privilege block in this migration.';

-- ---------------------------------------------------------------------
-- 2. History
-- ---------------------------------------------------------------------

create table public.cost_price_history (
  id uuid primary key default gen_random_uuid(),
  -- Exactly one of these is set: a row prices either a whole game or one
  -- specific variant of it, never both and never neither.
  game_id uuid references public.games (id) on delete cascade,
  variant_id uuid references public.game_variants (id) on delete cascade,
  cost_price numeric(10, 2) not null check (cost_price >= 0),
  -- The day this cost took effect. A date, not a timestamp: cost changes
  -- are a business fact recorded per-day, and a date keeps "what was the
  -- cost on 2026-03-04" unambiguous across timezones.
  effective_from date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  -- ON DELETE SET NULL, not the bare reference audit_log.actor_id uses:
  -- a cost change is a business fact that must outlive the admin account
  -- that entered it. A blocking FK here would also make deleting any
  -- admin who ever set a price fail outright.
  created_by uuid references public.profiles (id) on delete set null,
  constraint cost_price_history_target_check check (
    (game_id is not null and variant_id is null)
    or (game_id is null and variant_id is not null)
  )
);

create index idx_cost_price_history_game on public.cost_price_history (game_id, effective_from desc)
  where game_id is not null;
create index idx_cost_price_history_variant on public.cost_price_history (variant_id, effective_from desc)
  where variant_id is not null;

alter table public.cost_price_history enable row level security;

-- Deliberately NO policy for anon or authenticated, and no grants to
-- either: same shape as game_credentials (20260818000004), which is the
-- established pattern in this schema for data the service role reaches
-- only through a requireAdmin()-gated server action. There is no client
-- role that should ever see cost data, so there is no policy to write.
-- Supabase's self-hosted bootstrap grants table privileges to anon and
-- authenticated by default, so "enable RLS and write no policy" leaves
-- them with SELECT privilege and merely zero visible rows — an empty
-- array, not a refusal. Revoke explicitly so the answer is a hard
-- permission error and a future policy added here can't silently open
-- the table to a client role.
revoke all on public.cost_price_history from anon, authenticated;
grant all on public.cost_price_history to service_role;

-- ---------------------------------------------------------------------
-- 3. The lock: cost as it stood when the order was approved
-- ---------------------------------------------------------------------

alter table public.order_items
  add column cost_price numeric(10, 2) check (cost_price is null or cost_price >= 0),
  add column cost_locked_at timestamptz,
  -- Which variant this line was for. Nothing populates it yet (checkout
  -- records only game_id today), but the cost lock below prefers a
  -- variant's own cost when it IS set, so per-variant costing starts
  -- working the moment checkout begins writing it — no second migration.
  add column variant_id uuid references public.game_variants (id);

comment on column public.order_items.cost_price is
  'Cost locked at approval by approve_order(). Never recalculated: later cost changes must not move an already-approved order''s profit. NULL means no cost was on record at approval time.';

-- ---------------------------------------------------------------------
-- 4. Historical lookup
-- ---------------------------------------------------------------------

-- The cost that applied to a game (or one of its variants) on a given
-- date. Prefers the most recent history row effective on or before that
-- date; falls back to the row's current cost_price column when the item
-- has no history at all (nothing has ever changed it, so the current
-- value IS the value that applied). Variant lookups fall back to the
-- parent game's cost before giving up, since a variant without its own
-- cost inherits the product's.
create or replace function public.cost_price_at(
  p_game_id uuid,
  p_variant_id uuid,
  p_at timestamptz default now()
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cost numeric(10, 2);
  v_on date := (p_at at time zone 'UTC')::date;
begin
  if p_variant_id is not null then
    select h.cost_price into v_cost
      from public.cost_price_history h
     where h.variant_id = p_variant_id and h.effective_from <= v_on
     order by h.effective_from desc, h.created_at desc
     limit 1;
    if v_cost is not null then return v_cost; end if;

    select v.cost_price into v_cost from public.game_variants v where v.id = p_variant_id;
    if v_cost is not null then return v_cost; end if;

    -- Inherit the parent game's cost when the variant carries none.
    if p_game_id is null then
      select v.game_id into p_game_id from public.game_variants v where v.id = p_variant_id;
    end if;
  end if;

  if p_game_id is not null then
    select h.cost_price into v_cost
      from public.cost_price_history h
     where h.game_id = p_game_id and h.effective_from <= v_on
     order by h.effective_from desc, h.created_at desc
     limit 1;
    if v_cost is not null then return v_cost; end if;

    select g.cost_price into v_cost from public.games g where g.id = p_game_id;
  end if;

  return v_cost;
end;
$$;

revoke all on function public.cost_price_at(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.cost_price_at(uuid, uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------
-- 5. approve_order locks the cost in
-- ---------------------------------------------------------------------

-- Rebased on the CURRENT definition (20260908000001_gift_card_checkout.sql),
-- not the older multi-item one: this function has been replaced three
-- times, and each redefinition must carry every prior branch forward.
-- Dropping the gift-card delivery block here left codes stuck at
-- 'reserved' after approval — caught by gift-card-checkout.test.ts.
-- The lock is written INSIDE this function (not from application code) so
-- it shares the function's transaction: an order can never end up approved
-- with its cost unlocked, and the `cost_price is null` guard makes a
-- re-approval attempt a no-op rather than a silent re-pricing.
create or replace function public.approve_order(p_order_id uuid, p_admin_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status not in ('under_review', 'payment_claimed') then
    raise exception 'INVALID_TRANSITION';
  end if;

  update public.orders
  set status = 'approved', reviewed_by = p_admin_id, reviewed_at = now()
  where id = p_order_id
  returning * into v_order;

  update public.game_credentials
  set status = 'sold', sold_at = now()
  where id in (
    select credential_id from public.order_items
    where order_id = p_order_id and credential_id is not null
  );

  update public.gift_card_codes
  set status = 'delivered', delivered_at = now()
  where id in (
    select gift_card_code_id from public.order_items
    where order_id = p_order_id and gift_card_code_id is not null
  );

  update public.order_items oi
  set cost_price = public.cost_price_at(oi.game_id, oi.variant_id, now()),
      cost_locked_at = now()
  where oi.order_id = p_order_id
    and oi.cost_price is null;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    p_admin_id,
    'order_approved',
    'order',
    p_order_id,
    jsonb_build_object('order_id', p_order_id, 'amount', v_order.amount_exact)
  );

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Profit reporting
-- ---------------------------------------------------------------------

-- Revenue is recognized on orders.reviewed_at, matching the existing
-- convention in src/lib/admin-stats.ts ("an order that was only ever
-- initiated isn't revenue; approval is when the sale is confirmed").
--
-- Items with no locked cost are NOT silently treated as zero-cost, which
-- would overstate profit. They contribute their revenue and are counted
-- in items_missing_cost so the UI can say the figure is incomplete.
create or replace function public.get_profit_series(
  p_granularity text default 'day',
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now()
)
returns table (
  bucket timestamptz,
  revenue numeric,
  cost numeric,
  profit numeric,
  items_sold bigint,
  items_missing_cost bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    date_trunc(
      case lower(p_granularity) when 'week' then 'week' when 'month' then 'month' else 'day' end,
      o.reviewed_at
    ) as bucket,
    sum(oi.price)::numeric as revenue,
    sum(coalesce(oi.cost_price, 0))::numeric as cost,
    (sum(oi.price) - sum(coalesce(oi.cost_price, 0)))::numeric as profit,
    count(*)::bigint as items_sold,
    count(*) filter (where oi.cost_price is null)::bigint as items_missing_cost
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status = 'approved'
    and o.reviewed_at is not null
    and o.reviewed_at >= p_from
    and o.reviewed_at <= p_to
  group by 1
  order by 1;
$$;

create or replace function public.get_profit_by_product(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now()
)
returns table (
  game_id uuid,
  title text,
  slug text,
  revenue numeric,
  cost numeric,
  profit numeric,
  items_sold bigint,
  items_missing_cost bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id as game_id,
    g.title,
    g.slug,
    sum(oi.price)::numeric as revenue,
    sum(coalesce(oi.cost_price, 0))::numeric as cost,
    (sum(oi.price) - sum(coalesce(oi.cost_price, 0)))::numeric as profit,
    count(*)::bigint as items_sold,
    count(*) filter (where oi.cost_price is null)::bigint as items_missing_cost
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.games g on g.id = oi.game_id
  where o.status = 'approved'
    and o.reviewed_at is not null
    and o.reviewed_at >= p_from
    and o.reviewed_at <= p_to
  group by g.id, g.title, g.slug
  order by profit desc;
$$;

revoke all on function public.get_profit_series(text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.get_profit_by_product(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.get_profit_series(text, timestamptz, timestamptz) to service_role;
grant execute on function public.get_profit_by_product(timestamptz, timestamptz) to service_role;

-- ---------------------------------------------------------------------
-- 7. Column-privilege lockdown — the actual guarantee
-- ---------------------------------------------------------------------
--
-- A table-wide GRANT SELECT covers every column, including ones added
-- later, so simply adding cost_price above would have published it to
-- anon the instant any `select=*` ran — and two live call sites do
-- exactly that, one of them in the BROWSER (src/lib/use-games-by-ids.ts).
-- Convention alone cannot hold this line.
--
-- So: revoke the table-wide SELECT and re-grant it column by column,
-- omitting the cost columns. This is fail-CLOSED — a future `select=*`
-- as anon now errors with "permission denied for column cost_price"
-- instead of quietly leaking margin data.
--
-- MAINTENANCE: a later migration that ADDS a column to games,
-- game_variants or order_items must also grant it to these roles, or it
-- will be invisible to the public site. The DO block regenerates the full
-- list from information_schema, so re-running this pattern is the fix.
do $$
declare
  t text;
  cols text;
begin
  foreach t in array array['games', 'game_variants', 'order_items'] loop
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into cols
      from information_schema.columns
     where table_schema = 'public'
       and table_name = t
       and column_name <> 'cost_price';

    execute format('revoke select on public.%I from anon, authenticated', t);
    execute format('grant select (%s) on public.%I to anon, authenticated', cols, t);
  end loop;
end $$;
