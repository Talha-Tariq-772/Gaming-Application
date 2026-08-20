-- create_order: the checkout flow has a chicken-and-egg problem (an order
-- id is needed to reserve a credential against, but the order needs a real
-- amount/reservation window that only exist once a credential is actually
-- reserved). Resolved by inserting a placeholder-amount order row first,
-- reserving the credential, then finalizing the order — all inside this one
-- function body, which Postgres runs as a single transaction. If
-- reservation fails, the raised exception rolls back the placeholder order
-- insert too, so no orphaned "awaiting_payment" rows survive an
-- out-of-stock attempt.
create or replace function public.create_order(
  p_user_id uuid,
  p_game_id uuid,
  p_payment_method_id uuid,
  p_phone_number text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_order public.orders;
  v_credential_id uuid;
  v_reserved_until timestamptz;
begin
  select * into v_game from public.games where id = p_game_id;
  if v_game.id is null then
    raise exception 'GAME_NOT_FOUND';
  end if;
  if not v_game.is_active then
    raise exception 'GAME_NOT_ACTIVE';
  end if;

  -- Cheap pre-check so the common out-of-stock case never even creates a
  -- throwaway order row. reserve_credential() below is still the
  -- authoritative, concurrency-safe check — this is just an optimization.
  if not exists (
    select 1 from public.game_credentials
    where game_id = p_game_id and status = 'available'
  ) then
    raise exception 'OUT_OF_STOCK';
  end if;

  if p_phone_number is not null then
    update public.profiles set phone_number = p_phone_number where id = p_user_id;
  end if;

  insert into public.orders (user_id, status, payment_reference, amount_exact, payment_method_id)
  values (
    p_user_id,
    'awaiting_payment',
    public.generate_unique_payment_reference(),
    v_game.price,
    p_payment_method_id
  )
  returning * into v_order;

  v_credential_id := public.reserve_credential(p_game_id, v_order.id);
  if v_credential_id is null then
    raise exception 'OUT_OF_STOCK';
  end if;

  select reserved_until into v_reserved_until
  from public.game_credentials
  where id = v_credential_id;

  update public.orders
  set amount_exact = public.generate_unique_amount(v_game.price),
      reserved_until = v_reserved_until
  where id = v_order.id
  returning * into v_order;

  insert into public.order_items (order_id, game_id, credential_id, price)
  values (v_order.id, p_game_id, v_credential_id, v_order.amount_exact);

  return v_order;
end;
$$;

revoke all on function public.create_order(uuid, uuid, uuid, text) from public;
grant execute on function public.create_order(uuid, uuid, uuid, text) to service_role;

-- approve_order / reject_order: each touches orders + game_credentials +
-- audit_log together. Wrapped in one function (one transaction) so an
-- approved order can never end up paired with a credential that's still
-- 'reserved' instead of 'sold' (or vice versa for the released-back-to-pool
-- case on rejection) if a later step were to fail.
create or replace function public.approve_order(p_order_id uuid, p_admin_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_credential_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status not in ('under_review', 'payment_claimed') then
    raise exception 'INVALID_TRANSITION';
  end if;

  select oi.credential_id into v_credential_id
  from public.order_items oi
  where oi.order_id = p_order_id
  limit 1;

  update public.orders
  set status = 'approved', reviewed_by = p_admin_id, reviewed_at = now()
  where id = p_order_id
  returning * into v_order;

  if v_credential_id is not null then
    update public.game_credentials
    set status = 'sold', sold_at = now()
    where id = v_credential_id;
  end if;

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

revoke all on function public.approve_order(uuid, uuid) from public;
grant execute on function public.approve_order(uuid, uuid) to service_role;

create or replace function public.reject_order(p_order_id uuid, p_admin_id uuid, p_reason text)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_credential_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status not in ('under_review', 'payment_claimed') then
    raise exception 'INVALID_TRANSITION';
  end if;

  select oi.credential_id into v_credential_id
  from public.order_items oi
  where oi.order_id = p_order_id
  limit 1;

  update public.orders
  set status = 'rejected', reviewed_by = p_admin_id, reviewed_at = now(), rejection_reason = p_reason
  where id = p_order_id
  returning * into v_order;

  if v_credential_id is not null then
    update public.game_credentials
    set status = 'available', order_id = null, reserved_until = null
    where id = v_credential_id;
  end if;

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

revoke all on function public.reject_order(uuid, uuid, text) from public;
grant execute on function public.reject_order(uuid, uuid, text) to service_role;
