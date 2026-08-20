-- Replaces the single-game create_order() with a multi-item version: one
-- order, many order_items, one payment_reference, one summed amount_exact.
-- Different arity/types than the old signature, so it's dropped explicitly
-- rather than left as a stale, now-unused overload.
drop function if exists public.create_order(uuid, uuid, uuid, text);

-- p_items is a jsonb array of {"game_id": uuid, "payment_method_id": uuid}
-- (checkout only ever offers one payment method for the whole cart, so
-- every item carries the same payment_method_id — the order row's single
-- payment_method_id column is set from the first item).
create or replace function public.create_order(
  p_user_id uuid,
  p_items jsonb,
  p_phone_number text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_game_id uuid;
  v_price numeric(10, 2);
  v_total numeric(10, 2) := 0;
  v_payment_method_id uuid;
  v_order public.orders;
  v_credential_id uuid;
  v_reserved_until timestamptz;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  v_payment_method_id := (p_items -> 0 ->> 'payment_method_id')::uuid;

  -- Cheap pre-check for every item so the common out-of-stock case never
  -- creates a throwaway order row. reserve_credential() in the loop below
  -- is still the authoritative, concurrency-safe check per item.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
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

    v_total := v_total + v_price;
  end loop;

  if p_phone_number is not null then
    update public.profiles set phone_number = p_phone_number where id = p_user_id;
  end if;

  insert into public.orders (user_id, status, payment_reference, amount_exact, payment_method_id)
  values (
    p_user_id,
    'awaiting_payment',
    public.generate_unique_payment_reference(),
    v_total,
    v_payment_method_id
  )
  returning * into v_order;

  -- Real, atomic reservation per item. If ANY item is out of stock here
  -- (lost a race against another checkout since the pre-check above),
  -- raising rolls back the WHOLE transaction — the order row, and every
  -- game_credentials UPDATE already done by reserve_credential() earlier
  -- in this same loop, all unwind together. No manual "release what we
  -- already grabbed" step needed; Postgres does it as part of the abort.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_game_id := (v_item ->> 'game_id')::uuid;

    v_credential_id := public.reserve_credential(v_game_id, v_order.id);
    if v_credential_id is null then
      raise exception 'OUT_OF_STOCK:%', v_game_id;
    end if;

    select price into v_price from public.games where id = v_game_id;

    insert into public.order_items (order_id, game_id, credential_id, price)
    values (v_order.id, v_game_id, v_credential_id, v_price);
  end loop;

  -- now() is stable within a transaction, so this matches exactly what
  -- every reserve_credential() call above just set on its own row.
  v_reserved_until := now() + interval '45 minutes';

  update public.orders
  set amount_exact = public.generate_unique_amount(v_total),
      reserved_until = v_reserved_until
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.create_order(uuid, jsonb, text) from public;
grant execute on function public.create_order(uuid, jsonb, text) to service_role;

-- approve_order / reject_order updated to handle every credential linked
-- to the order, not just one (order_items.credential_id, one row per item).
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
