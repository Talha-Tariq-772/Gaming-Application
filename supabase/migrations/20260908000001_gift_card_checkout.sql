-- Wires gift cards through cart/checkout. order_items grows a gift-card
-- branch (product_type + gift_card_code_id, game_id/credential_id now
-- nullable), create_order/approve_order/reject_order grow matching
-- branches, and orders gains a region-acknowledgement stamp. Builds on
-- supabase/migrations/20260901000002_gift_cards.sql (gift_card_products/
-- gift_card_codes/reserve_gift_card_code, added but never wired to
-- checkout) and 20260907000001_guest_checkout.sql (create_order's current
-- shape).

alter table public.order_items
  add column product_type text not null default 'game' check (product_type in ('game', 'gift_card')),
  add column gift_card_code_id uuid references public.gift_card_codes (id),
  alter column game_id drop not null;

-- Every existing row is a 'game' row with game_id already set (the column
-- default above backfills product_type for them), so this holds without a
-- separate backfill step.
alter table public.order_items
  add constraint order_items_product_shape_chk
  check (
    (product_type = 'game' and game_id is not null and gift_card_code_id is null)
    or (product_type = 'gift_card' and gift_card_code_id is not null and game_id is null)
  );

create index idx_order_items_gift_card_code_id on public.order_items (gift_card_code_id)
  where gift_card_code_id is not null;

-- Stamped in create_order's final update, same transaction that sets
-- amount_exact — dispute evidence that the buyer saw and accepted the
-- platform/region for every gift card in the order before it was placed.
alter table public.orders add column region_ack_confirmed_at timestamptz;

-- create_order: each item in p_items now carries a "product_type" field
-- ('game' or 'gift_card', defaulting to 'game' for callers that predate
-- this migration would not exist since this drops the old signature
-- outright). A gift-card item carries "product_id" instead of "game_id".
-- p_region_ack must be true if any item is a gift card. Arity grows (4
-- params -> 5), so dropped and recreated rather than left as a stale
-- overload, matching this file's own established convention.
drop function if exists public.create_order(uuid, jsonb, text, text);

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
begin
  if p_user_id is null and p_guest_phone is null then
    raise exception 'GUEST_PHONE_REQUIRED';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  v_payment_method_id := (p_items -> 0 ->> 'payment_method_id')::uuid;

  -- Cheap pre-check for every item so the common out-of-stock case never
  -- creates a throwaway order row. reserve_credential()/
  -- reserve_gift_card_code() in the loop below are still the authoritative,
  -- concurrency-safe checks per item.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_type := coalesce(v_item ->> 'product_type', 'game');

    if v_product_type = 'gift_card' then
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
  -- (lost a race against another checkout since the pre-check above),
  -- raising rolls back the WHOLE transaction — the order row, and every
  -- game_credentials/gift_card_codes UPDATE already done earlier in this
  -- same loop, all unwind together.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_type := coalesce(v_item ->> 'product_type', 'game');

    if v_product_type = 'gift_card' then
      v_product_id := (v_item ->> 'product_id')::uuid;

      v_gift_card_code_id := public.reserve_gift_card_code(v_product_id, v_order.id);
      if v_gift_card_code_id is null then
        raise exception 'OUT_OF_STOCK:%', v_product_id;
      end if;

      select price_pkr into v_price from public.gift_card_products where id = v_product_id;

      insert into public.order_items (order_id, game_id, credential_id, product_type, gift_card_code_id, price)
      values (v_order.id, null, null, 'gift_card', v_gift_card_code_id, v_price);
    else
      v_game_id := (v_item ->> 'game_id')::uuid;

      v_credential_id := public.reserve_credential(v_game_id, v_order.id);
      if v_credential_id is null then
        raise exception 'OUT_OF_STOCK:%', v_game_id;
      end if;

      select price into v_price from public.games where id = v_game_id;

      insert into public.order_items (order_id, game_id, credential_id, product_type, gift_card_code_id, price)
      values (v_order.id, v_game_id, v_credential_id, 'game', null, v_price);
    end if;
  end loop;

  -- now() is stable within a transaction, so this matches exactly what
  -- every reserve_credential() call above just set on its own row.
  -- gift_card_codes has no reserved_until of its own — the order's own
  -- reserved_until is the single expiry that governs both branches (see
  -- release_expired_reservations below).
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

-- approve_order/reject_order grow a mirrored gift-card branch alongside the
-- existing credential update — the FOR UPDATE SKIP LOCKED reservation from
-- create_order is untouched; this just settles what was already reserved.
-- gift_card_codes' terminal status is 'delivered', not 'sold' (see its
-- check constraint, 20260901000002_gift_cards.sql) — game_credentials uses
-- 'sold'; the two are deliberately not unified into one status vocabulary.
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

-- release_expired_reservations: mirrors the game_credentials release for
-- gift_card_codes so a code reserved by an order that just expired doesn't
-- stay 'reserved' forever — gift_card_codes has no reserved_until of its
-- own (see reserve_gift_card_code), so this keys off the order itself
-- (already flipped to 'expired' by the update immediately above) instead.
create or replace function public.release_expired_reservations()
returns void
language plpgsql
security definer
set search_path = public
as $$
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
end;
$$;
