-- Hardware and accessories: a THIRD product family alongside games
-- (public.games + game_credentials) and gift cards (gift_card_products +
-- gift_card_codes).
--
-- Why a separate table rather than a games.product_type value: the two
-- digital families are unit-per-row inventories — one credential row, one
-- code row, each sold exactly once. Hardware is a physical COUNTER:
-- twelve identical DualSense controllers are one product with
-- stock_quantity = 12, not twelve rows. That difference drives every
-- design choice below (reservation, release, idempotency), and folding it
-- into either existing table would mean a stock model that contradicts
-- the table it lives in.
--
-- Scope: schema + RLS + column lockdown + full checkout wiring +
-- cost/profit reporting. Unlike 20260901000002_gift_cards.sql, which
-- deliberately deferred checkout to a later migration and consequently
-- left gift cards silently absent from the profit report for three
-- sessions, hardware is wired end to end here so it can never be a
-- product that exists but reports as nothing.

-- ---------------------------------------------------------------------
-- 1. The catalog table
-- ---------------------------------------------------------------------

create table public.hardware_products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  -- `name`, not `title`. Every other catalog table in this schema uses
  -- title; this one is named for what the spec asked for. The profit
  -- report coalesces across all three (see get_profit_by_product below),
  -- so the difference costs one coalesce arm and nothing else.
  name text not null,
  description text not null default '',
  category text not null check (
    category in ('console', 'controller', 'headset', 'storage', 'cable', 'accessory')
  ),
  -- NULL = no cost recorded, which the profit report counts in
  -- items_missing_cost rather than assuming zero. Same contract as
  -- games.cost_price and gift_card_products.cost_price. Never exposed to
  -- anon/authenticated — see the column-privilege block in section 8.
  cost_price numeric(10, 2) check (cost_price is null or cost_price >= 0),
  sale_price numeric(10, 2) not null check (sale_price > 0),
  -- A counter, not a row-per-unit inventory. Reserved units are
  -- decremented out of this immediately at checkout and added back by
  -- release_hardware_stock_for_order() if the order is rejected or
  -- expires, so this column always reads as "units nobody is holding".
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  -- Several photos per product (box, front, ports), unlike a game's
  -- single cover. Ordered: the first entry is the one a card/listing
  -- renders. Empty array is valid and falls back to a placeholder.
  image_urls text[] not null default '{}',
  is_active boolean not null default false,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_hardware_products_category on public.hardware_products (category)
  where is_active = true;

comment on column public.hardware_products.cost_price is
  'Current unit cost to us, in PKR. NULL = not yet recorded (counted in items_missing_cost rather than assumed zero). Never exposed to anon/authenticated — see the column-privilege block in this migration.';
comment on column public.hardware_products.stock_quantity is
  'Unreserved units on hand. Decremented by reserve_hardware_stock() at checkout and restored by release_hardware_stock_for_order() on rejection/expiry — NOT a count of units in the warehouse while an order is pending.';

-- RLS: mirrors gift_card_products exactly
-- (supabase/migrations/20260901000002_gift_cards.sql), which itself
-- mirrors games_select / games_admin_*.
alter table public.hardware_products enable row level security;

create policy "hardware_products_select" on public.hardware_products
  for select
  using (is_active = true or public.current_profile_role() = 'admin');

create policy "hardware_products_admin_insert" on public.hardware_products
  for insert
  with check (public.current_profile_role() = 'admin');

create policy "hardware_products_admin_update" on public.hardware_products
  for update
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

create policy "hardware_products_admin_delete" on public.hardware_products
  for delete
  using (public.current_profile_role() = 'admin');

grant insert, update, delete on public.hardware_products to authenticated;
grant all on public.hardware_products to service_role;
-- SELECT is granted column-by-column in section 8, not here: a table-wide
-- grant would publish cost_price.

-- ---------------------------------------------------------------------
-- 2. Cost history
-- ---------------------------------------------------------------------

-- Fourth target on the one shared history table, same reasoning
-- 20260920000004 gave for adding the third: one table means
-- cost_price_at() has one place to look and the admin UI one shape to
-- render.
alter table public.cost_price_history
  add column hardware_product_id uuid references public.hardware_products (id) on delete cascade;

alter table public.cost_price_history
  drop constraint cost_price_history_target_check;

alter table public.cost_price_history
  add constraint cost_price_history_target_check check (
    (game_id is not null)::int
    + (variant_id is not null)::int
    + (gift_card_product_id is not null)::int
    + (hardware_product_id is not null)::int
    = 1
  );

create index idx_cost_price_history_hardware
  on public.cost_price_history (hardware_product_id, effective_from desc)
  where hardware_product_id is not null;

-- ---------------------------------------------------------------------
-- 3. order_items grows a hardware branch
-- ---------------------------------------------------------------------

alter table public.order_items
  add column hardware_product_id uuid references public.hardware_products (id),
  -- Idempotency marker for stock return, and the single reason a counter
  -- inventory needs one. A row-per-unit inventory is self-idempotent:
  -- setting a code back to 'available' twice is the same as once. Adding
  -- 1 back to stock_quantity twice is NOT — and
  -- release_expired_reservations() runs on a cron over every expired
  -- order, so without this marker each pass would inflate stock again,
  -- forever. Set once, when the unit is actually returned.
  add column hardware_stock_released_at timestamptz;

alter table public.order_items
  drop constraint order_items_product_type_check;

alter table public.order_items
  add constraint order_items_product_type_check
  check (product_type in ('game', 'gift_card', 'hardware'));

alter table public.order_items
  drop constraint order_items_product_shape_chk;

-- A hardware line carries neither a game nor a code — it points at the
-- product directly, because there is no per-unit row to point at.
alter table public.order_items
  add constraint order_items_product_shape_chk
  check (
    (product_type = 'game'
      and game_id is not null and gift_card_code_id is null and hardware_product_id is null)
    or (product_type = 'gift_card'
      and gift_card_code_id is not null and game_id is null and hardware_product_id is null)
    or (product_type = 'hardware'
      and hardware_product_id is not null and game_id is null and gift_card_code_id is null)
  );

create index idx_order_items_hardware_product_id on public.order_items (hardware_product_id)
  where hardware_product_id is not null;

-- ---------------------------------------------------------------------
-- 4. Stock reservation and release
-- ---------------------------------------------------------------------

-- The counter equivalent of reserve_credential / reserve_gift_card_code.
-- Those use FOR UPDATE SKIP LOCKED to hand out a distinct row per caller;
-- there are no rows here, so atomicity comes from the UPDATE's own WHERE
-- instead. `stock_quantity > 0` is re-evaluated under the row lock the
-- UPDATE takes, so two concurrent checkouts for the last unit cannot both
-- succeed — the loser sees 0 rows updated and gets false, exactly as the
-- loser of a SKIP LOCKED race gets null.
create or replace function public.reserve_hardware_stock(p_product_id uuid, p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.hardware_products
  set stock_quantity = stock_quantity - 1
  where id = p_product_id and is_active = true and stock_quantity > 0;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

-- Returns every still-held hardware unit on an order to stock, exactly
-- once. Safe to call repeatedly on the same order (the cron does): the
-- `hardware_stock_released_at is null` filter is what makes the second
-- call a no-op rather than a second refund of the same unit.
--
-- The CTE ordering matters — order_items is stamped in the same statement
-- that computes the counts, so a concurrent caller cannot read the same
-- unreleased rows and double-credit them.
create or replace function public.release_hardware_stock_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with released as (
    update public.order_items
    set hardware_stock_released_at = now()
    where order_id = p_order_id
      and product_type = 'hardware'
      and hardware_product_id is not null
      and hardware_stock_released_at is null
    returning hardware_product_id
  ), totals as (
    select hardware_product_id, count(*)::integer as units
    from released
    group by hardware_product_id
  )
  update public.hardware_products h
  set stock_quantity = h.stock_quantity + t.units
  from totals t
  where h.id = t.hardware_product_id;
end;
$$;

revoke all on function public.reserve_hardware_stock(uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_hardware_stock_for_order(uuid) from public, anon, authenticated;
grant execute on function public.reserve_hardware_stock(uuid, uuid) to service_role;
grant execute on function public.release_hardware_stock_for_order(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 5. Historical cost lookup, now hardware-aware
-- ---------------------------------------------------------------------

-- Same one-function contract 20260920000004 established, plus
-- p_hardware_product_id. The old 4-argument signature is dropped below
-- for the same reason the 3-argument one was: a stale caller would
-- silently resolve NULL for a hardware line, which is precisely the
-- "product exists but reports no cost" bug this migration exists to
-- avoid repeating.
create or replace function public.cost_price_at(
  p_game_id uuid,
  p_variant_id uuid,
  p_gift_card_product_id uuid,
  p_hardware_product_id uuid,
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
  if p_hardware_product_id is not null then
    select h.cost_price into v_cost
      from public.cost_price_history h
     where h.hardware_product_id = p_hardware_product_id and h.effective_from <= v_on
     order by h.effective_from desc, h.created_at desc
     limit 1;
    if v_cost is not null then return v_cost; end if;

    select p.cost_price into v_cost
      from public.hardware_products p where p.id = p_hardware_product_id;
    return v_cost;
  end if;

  if p_gift_card_product_id is not null then
    select h.cost_price into v_cost
      from public.cost_price_history h
     where h.gift_card_product_id = p_gift_card_product_id and h.effective_from <= v_on
     order by h.effective_from desc, h.created_at desc
     limit 1;
    if v_cost is not null then return v_cost; end if;

    select p.cost_price into v_cost
      from public.gift_card_products p where p.id = p_gift_card_product_id;
    return v_cost;
  end if;

  if p_variant_id is not null then
    select h.cost_price into v_cost
      from public.cost_price_history h
     where h.variant_id = p_variant_id and h.effective_from <= v_on
     order by h.effective_from desc, h.created_at desc
     limit 1;
    if v_cost is not null then return v_cost; end if;

    select v.cost_price into v_cost from public.game_variants v where v.id = p_variant_id;
    if v_cost is not null then return v_cost; end if;

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

drop function if exists public.cost_price_at(uuid, uuid, uuid, timestamptz);

revoke all on function public.cost_price_at(uuid, uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.cost_price_at(uuid, uuid, uuid, uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------
-- 6. Checkout: create_order / approve_order / reject_order / expiry
-- ---------------------------------------------------------------------

-- create_order: a hardware item carries
-- {"product_type": "hardware", "product_id": "<uuid>"}. Arity is
-- unchanged from 20260908000001, so this is a plain replace.
--
-- Hardware is ONE UNIT PER LINE, same as both digital families — there is
-- no quantity column on order_items and this migration does not add one.
-- Two controllers is two cart lines, each reserving one unit.
create or replace function public.create_order(
  p_user_id uuid,
  p_items jsonb,
  p_phone_number text,
  p_guest_phone text default null,
  p_region_ack boolean default false
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product_type text;
  v_game_id uuid;
  v_product_id uuid;
  v_price numeric(10, 2);
  v_total numeric(10, 2) := 0;
  v_payment_method_id uuid;
  v_order public.orders;
  v_credential_id uuid;
  v_gift_card_code_id uuid;
  v_reserved_until timestamptz;
  v_has_gift_card boolean := false;
  v_reserved boolean;
  -- How many units of each hardware product this cart has already claimed
  -- in the pre-check loop. Without it, two lines for the same product
  -- both see stock_quantity = 1 and both pass, only for the second
  -- reservation to fail in the loop below and roll the whole order back
  -- — a correct outcome reached by the expensive path. Counting here
  -- turns that into the cheap up-front OUT_OF_STOCK every other branch
  -- already gives.
  v_claimed jsonb := '{}'::jsonb;
  v_already integer;
  v_on_hand integer;
begin
  if p_user_id is null and p_guest_phone is null then
    raise exception 'GUEST_PHONE_REQUIRED';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  v_payment_method_id := (p_items -> 0 ->> 'payment_method_id')::uuid;

  -- Cheap pre-check for every item so the common out-of-stock case never
  -- creates a throwaway order row. The reserve_* calls in the second loop
  -- are still the authoritative, concurrency-safe checks per item.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_type := coalesce(v_item ->> 'product_type', 'game');

    if v_product_type = 'hardware' then
      v_product_id := (v_item ->> 'product_id')::uuid;

      select sale_price, stock_quantity into v_price, v_on_hand
        from public.hardware_products
       where id = v_product_id and is_active = true;
      if v_price is null then
        raise exception 'GAME_NOT_FOUND:%', v_product_id;
      end if;

      v_already := coalesce((v_claimed ->> v_product_id::text)::integer, 0);
      if v_on_hand <= v_already then
        raise exception 'OUT_OF_STOCK:%', v_product_id;
      end if;
      v_claimed := jsonb_set(
        v_claimed,
        array[v_product_id::text],
        to_jsonb(v_already + 1),
        true
      );
    elsif v_product_type = 'gift_card' then
      v_has_gift_card := true;
      v_product_id := (v_item ->> 'product_id')::uuid;

      select price_pkr into v_price from public.gift_card_products where id = v_product_id and is_active = true;
      if v_price is null then
        raise exception 'GAME_NOT_FOUND:%', v_product_id;
      end if;

      if not exists (
        select 1 from public.gift_card_codes
        where product_id = v_product_id and status = 'available'
      ) then
        raise exception 'OUT_OF_STOCK:%', v_product_id;
      end if;
    else
      v_game_id := (v_item ->> 'game_id')::uuid;

      select price into v_price from public.games where id = v_game_id and is_active = true;
      if v_price is null then
        raise exception 'GAME_NOT_FOUND:%', v_game_id;
      end if;

      if not exists (
        select 1 from public.game_credentials
        where game_id = v_game_id and status = 'available'
      ) then
        raise exception 'OUT_OF_STOCK:%', v_game_id;
      end if;
    end if;

    v_total := v_total + v_price;
  end loop;

  if v_has_gift_card and p_region_ack is not true then
    raise exception 'REGION_NOT_ACKNOWLEDGED';
  end if;

  if p_user_id is not null and p_phone_number is not null then
    update public.profiles set phone_number = p_phone_number where id = p_user_id;
  end if;

  insert into public.orders (user_id, guest_phone, status, payment_reference, amount_exact, payment_method_id)
  values (
    p_user_id,
    case when p_user_id is null then p_guest_phone else null end,
    'awaiting_payment',
    public.generate_unique_payment_reference(),
    v_total,
    v_payment_method_id
  )
  returning * into v_order;

  -- Real, atomic reservation per item. If ANY item is out of stock here
  -- (lost a race since the pre-check above), raising rolls back the WHOLE
  -- transaction — the order row, every credential/code UPDATE, and every
  -- hardware stock decrement already done earlier in this same loop, all
  -- unwind together. That rollback is exactly why a hardware decrement
  -- needs no compensating increment on this path; only a COMMITTED
  -- reservation (rejection, expiry) needs
  -- release_hardware_stock_for_order.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_type := coalesce(v_item ->> 'product_type', 'game');

    if v_product_type = 'hardware' then
      v_product_id := (v_item ->> 'product_id')::uuid;

      v_reserved := public.reserve_hardware_stock(v_product_id, v_order.id);
      if not v_reserved then
        raise exception 'OUT_OF_STOCK:%', v_product_id;
      end if;

      select sale_price into v_price from public.hardware_products where id = v_product_id;

      insert into public.order_items
        (order_id, game_id, credential_id, product_type, gift_card_code_id, hardware_product_id, price)
      values (v_order.id, null, null, 'hardware', null, v_product_id, v_price);
    elsif v_product_type = 'gift_card' then
      v_product_id := (v_item ->> 'product_id')::uuid;

      v_gift_card_code_id := public.reserve_gift_card_code(v_product_id, v_order.id);
      if v_gift_card_code_id is null then
        raise exception 'OUT_OF_STOCK:%', v_product_id;
      end if;

      select price_pkr into v_price from public.gift_card_products where id = v_product_id;

      insert into public.order_items
        (order_id, game_id, credential_id, product_type, gift_card_code_id, hardware_product_id, price)
      values (v_order.id, null, null, 'gift_card', v_gift_card_code_id, null, v_price);
    else
      v_game_id := (v_item ->> 'game_id')::uuid;

      v_credential_id := public.reserve_credential(v_game_id, v_order.id);
      if v_credential_id is null then
        raise exception 'OUT_OF_STOCK:%', v_game_id;
      end if;

      select price into v_price from public.games where id = v_game_id;

      insert into public.order_items
        (order_id, game_id, credential_id, product_type, gift_card_code_id, hardware_product_id, price)
      values (v_order.id, v_game_id, v_credential_id, 'game', null, null, v_price);
    end if;
  end loop;

  v_reserved_until := now() + interval '45 minutes';

  update public.orders
  set amount_exact = public.generate_unique_amount(v_total),
      reserved_until = v_reserved_until,
      region_ack_confirmed_at = case when v_has_gift_card then now() else null end
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.create_order(uuid, jsonb, text, text, boolean) from public;
grant execute on function public.create_order(uuid, jsonb, text, text, boolean) to service_role;

-- approve_order: rebased on 20260920000004's definition (the fourth
-- rewrite of this function). Every prior branch carried forward — the
-- credential sale, the gift-card delivery, the cost lock, the audit row.
--
-- A hardware line needs NO settlement update: its unit left stock at
-- reservation time and approval simply means it never comes back. The
-- cost lock below is the only hardware-specific work, and it now resolves
-- through cost_price_at's hardware branch instead of returning NULL and
-- reporting every controller sold as 100% margin — the exact bug gift
-- cards shipped with.
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
  set cost_price = public.cost_price_at(
        oi.game_id,
        oi.variant_id,
        (select c.product_id from public.gift_card_codes c where c.id = oi.gift_card_code_id),
        oi.hardware_product_id,
        now()
      ),
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

-- reject_order: rebased on 20260908000001's definition, plus the hardware
-- stock return. Rejection is a COMMITTED reservation being undone, so
-- unlike create_order's rollback path this genuinely has to add the unit
-- back.
create or replace function public.reject_order(p_order_id uuid, p_admin_id uuid, p_reason text)
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
  set status = 'rejected', reviewed_by = p_admin_id, reviewed_at = now(), rejection_reason = p_reason
  where id = p_order_id
  returning * into v_order;

  update public.game_credentials
  set status = 'available', order_id = null, reserved_until = null
  where id in (
    select credential_id from public.order_items
    where order_id = p_order_id and credential_id is not null
  );

  update public.gift_card_codes
  set status = 'available', order_id = null, reserved_at = null
  where id in (
    select gift_card_code_id from public.order_items
    where order_id = p_order_id and gift_card_code_id is not null
  );

  perform public.release_hardware_stock_for_order(p_order_id);

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    p_admin_id,
    'order_rejected',
    'order',
    p_order_id,
    jsonb_build_object('order_id', p_order_id, 'reason', p_reason)
  );

  return v_order;
end;
$$;

-- release_expired_reservations: rebased on 20260908000001's definition.
-- Hardware units on a just-expired order go back to stock, keyed off the
-- order (like gift cards) rather than a per-unit reserved_until, because
-- a counter has no per-unit row to carry one.
--
-- This is the call site the hardware_stock_released_at marker exists for:
-- the cron re-runs this over the SAME expired orders on every pass, and
-- without the marker each pass would credit their units again.
create or replace function public.release_expired_reservations()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  update public.game_credentials
  set status = 'available', order_id = null, reserved_until = null
  where status = 'reserved' and reserved_until < now();

  update public.orders
  set status = 'expired'
  where status in ('awaiting_payment', 'payment_claimed')
    and reserved_until < now()
    and status != 'approved';

  update public.gift_card_codes
  set status = 'available', order_id = null, reserved_at = null
  where status = 'reserved'
    and order_id in (select id from public.orders where status = 'expired');

  for v_order_id in
    select distinct oi.order_id
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where oi.product_type = 'hardware'
       and oi.hardware_stock_released_at is null
       and o.status = 'expired'
  loop
    perform public.release_hardware_stock_for_order(v_order_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Profit reporting
-- ---------------------------------------------------------------------

-- get_profit_series needs no change: it aggregates order_items directly
-- with no product join, so a hardware line was already counted in its
-- revenue the moment one existed. get_profit_BY_PRODUCT is the one that
-- joined per product and silently dropped anything it didn't know about
-- — the gift-card bug, which a third product type would otherwise repeat
-- verbatim.
--
-- Return type is unchanged (product_type is already text), so this is a
-- plain replace rather than the drop/recreate 20260920000004 needed.
create or replace function public.get_profit_by_product(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now()
)
returns table (
  game_id uuid,
  title text,
  slug text,
  product_type text,
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
    coalesce(g.id, p.id, hw.id) as game_id,
    coalesce(g.title, p.title, hw.name) as title,
    coalesce(g.slug, p.slug, hw.slug) as slug,
    case
      when hw.id is not null then 'hardware'
      when p.id is not null then 'gift_card'
      else 'game'
    end as product_type,
    sum(oi.price)::numeric as revenue,
    sum(coalesce(oi.cost_price, 0))::numeric as cost,
    (sum(oi.price) - sum(coalesce(oi.cost_price, 0)))::numeric as profit,
    count(*)::bigint as items_sold,
    count(*) filter (where oi.cost_price is null)::bigint as items_missing_cost
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.games g on g.id = oi.game_id
  left join public.gift_card_codes c on c.id = oi.gift_card_code_id
  left join public.gift_card_products p on p.id = c.product_id
  left join public.hardware_products hw on hw.id = oi.hardware_product_id
  where o.status = 'approved'
    and o.reviewed_at is not null
    and o.reviewed_at >= p_from
    and o.reviewed_at <= p_to
    and coalesce(g.id, p.id, hw.id) is not null
  group by coalesce(g.id, p.id, hw.id),
           coalesce(g.title, p.title, hw.name),
           coalesce(g.slug, p.slug, hw.slug),
           case
             when hw.id is not null then 'hardware'
             when p.id is not null then 'gift_card'
             else 'game'
           end
  order by profit desc;
$$;

revoke all on function public.get_profit_by_product(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.get_profit_by_product(timestamptz, timestamptz) to service_role;

-- get_revenue_by_payment_method (20260921000001) needs no change at all.
-- It aggregates orders, not order_items, so it never had a product join
-- to drop a new product type out of — a hardware order's amount_exact
-- counts the instant the order is approved. Asserted directly in
-- tests/hardware.test.ts rather than assumed.

-- ---------------------------------------------------------------------
-- 8. Column-privilege lockdown
-- ---------------------------------------------------------------------
--
-- Same reasoning as 20260920000002_cost_price.sql and
-- 20260920000004_gift_card_cost_price.sql: a table-wide GRANT SELECT
-- covers every column including ones added later, so it would publish
-- cost_price to anon the instant any `select=*` ran. Revoke the
-- table-wide SELECT and re-grant column by column, omitting the cost
-- column, so a future `select=*` as anon errors instead of quietly
-- leaking margin data.
--
-- order_items is re-run here for a second reason: that earlier lockdown
-- replaced its table-wide grant with an explicit column list, so the two
-- columns section 3 just added (hardware_product_id,
-- hardware_stock_released_at) are currently ungranted and therefore
-- INVISIBLE to the public site. Regenerating from information_schema is
-- the documented fix, and hardware_product_id in particular has to be
-- readable — a customer's own order page selects it (see
-- PUBLIC_ORDER_ITEM_COLUMNS in src/lib/order-queries.ts).
do $$
declare
  t text;
  cols text;
begin
  foreach t in array array['hardware_products', 'order_items'] loop
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
