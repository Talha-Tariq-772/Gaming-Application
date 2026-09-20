-- Cost price for gift-card products.
--
-- 20260920000002_cost_price.sql put cost on games and game_variants only.
-- Gift-card lines carry game_id = NULL (order_items.game_id became
-- nullable when gift cards were added), so cost_price_at(NULL, NULL)
-- always returned NULL for them: every gift card sold counted toward
-- items_missing_cost forever, and profit on that whole product line read
-- as 100% margin. This closes that gap with the same three-part shape the
-- games side already uses: a current-cost column, history rows, and a
-- lock at approval.

-- ---------------------------------------------------------------------
-- 1. Current cost on the product
-- ---------------------------------------------------------------------

alter table public.gift_card_products
  add column cost_price numeric(10, 2) check (cost_price is null or cost_price >= 0);

comment on column public.gift_card_products.cost_price is
  'Current unit cost to us, in PKR. NULL = not yet recorded (counted in items_missing_cost rather than assumed zero). Never exposed to anon/authenticated — see the column-privilege block below.';

-- ---------------------------------------------------------------------
-- 2. History
-- ---------------------------------------------------------------------

-- cost_price_history previously allowed exactly one of game_id/variant_id.
-- Widen that to three targets rather than adding a second history table:
-- one table means cost_price_at has one place to look, and the admin UI
-- one shape to render.
alter table public.cost_price_history
  add column gift_card_product_id uuid references public.gift_card_products (id) on delete cascade;

alter table public.cost_price_history
  drop constraint cost_price_history_target_check;

alter table public.cost_price_history
  add constraint cost_price_history_target_check check (
    (game_id is not null)::int
    + (variant_id is not null)::int
    + (gift_card_product_id is not null)::int
    = 1
  );

create index idx_cost_price_history_gift_card
  on public.cost_price_history (gift_card_product_id, effective_from desc)
  where gift_card_product_id is not null;

-- ---------------------------------------------------------------------
-- 3. Historical lookup, now gift-card aware
-- ---------------------------------------------------------------------

-- Same contract as before plus p_gift_card_product_id. Kept as one
-- function (rather than a separate gift-card variant) so approve_order has
-- a single call site and the "which cost applied on this date" rule can
-- never drift between product types.
--
-- The old 3-argument signature is dropped below: leaving it in place would
-- let a stale caller silently resolve NULL for a gift-card line, which is
-- exactly the bug this migration exists to fix.
create or replace function public.cost_price_at(
  p_game_id uuid,
  p_variant_id uuid,
  p_gift_card_product_id uuid,
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

drop function if exists public.cost_price_at(uuid, uuid, timestamptz);

revoke all on function public.cost_price_at(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.cost_price_at(uuid, uuid, uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------
-- 4. approve_order resolves gift-card cost too
-- ---------------------------------------------------------------------

-- Rebased on the current definition (20260920000002_cost_price.sql, itself
-- rebased on 20260908000001_gift_card_checkout.sql). This function has now
-- been replaced four times — every redefinition must carry forward EVERY
-- earlier branch (credential sale, gift-card delivery, cost lock, audit
-- log). Dropping one is silent: the tests caught a missing gift-card
-- delivery block once already.
--
-- The cost lookup joins through gift_card_codes to reach the product,
-- because order_items records the CODE, not the product it came from.
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

-- ---------------------------------------------------------------------
-- 5. Profit by product now covers gift cards
-- ---------------------------------------------------------------------

-- get_profit_by_product joined order_items -> games, so gift-card lines
-- were dropped from the per-product table entirely (their revenue still
-- showed in the totals, which is why the tiles and the table disagreed).
-- Switch to a left join on each side and coalesce, so every line reports
-- under whichever product it actually came from.
-- Return type gains product_type, so CREATE OR REPLACE is not enough —
-- Postgres refuses to change a function's OUT-parameter row type in place.
drop function if exists public.get_profit_by_product(timestamptz, timestamptz);

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
    coalesce(g.id, p.id) as game_id,
    coalesce(g.title, p.title) as title,
    coalesce(g.slug, p.slug) as slug,
    case when p.id is not null then 'gift_card' else 'game' end as product_type,
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
  where o.status = 'approved'
    and o.reviewed_at is not null
    and o.reviewed_at >= p_from
    and o.reviewed_at <= p_to
    and coalesce(g.id, p.id) is not null
  group by coalesce(g.id, p.id), coalesce(g.title, p.title), coalesce(g.slug, p.slug),
           case when p.id is not null then 'gift_card' else 'game' end
  order by profit desc;
$$;

revoke all on function public.get_profit_by_product(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.get_profit_by_product(timestamptz, timestamptz) to service_role;

-- ---------------------------------------------------------------------
-- 6. Column-privilege lockdown for the new cost column
-- ---------------------------------------------------------------------
--
-- Same reasoning as 20260920000002_cost_price.sql: a table-wide GRANT
-- SELECT would publish cost_price to anon the moment any `select=*` ran.
-- Re-grant column by column, omitting cost_price, so a future `select=*`
-- as anon errors instead of leaking margin data.
--
-- MAINTENANCE: a later migration adding a column to gift_card_products
-- must also grant it to these roles, or it will be invisible publicly.
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'gift_card_products'
     and column_name <> 'cost_price';

  execute 'revoke select on public.gift_card_products from anon, authenticated';
  execute format('grant select (%s) on public.gift_card_products to anon, authenticated', cols);
end $$;
