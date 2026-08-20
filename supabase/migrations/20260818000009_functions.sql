-- Atomically claims the oldest available credential for a game, or returns
-- null if none is free. FOR UPDATE SKIP LOCKED means two concurrent callers
-- racing for the last credential never both succeed: the second caller
-- skips the row the first has locked and finds nothing else available.
create or replace function public.reserve_credential(p_game_id uuid, p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credential_id uuid;
begin
  select id into v_credential_id
  from public.game_credentials
  where game_id = p_game_id and status = 'available'
  order by created_at
  limit 1
  for update skip locked;

  if v_credential_id is null then
    return null;
  end if;

  update public.game_credentials
  set status = 'reserved',
      reserved_until = now() + interval '45 minutes',
      order_id = p_order_id
  where id = v_credential_id;

  return v_credential_id;
end;
$$;

revoke all on function public.reserve_credential(uuid, uuid) from public;
grant execute on function public.reserve_credential(uuid, uuid) to service_role;

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
end;
$$;

revoke all on function public.release_expired_reservations() from public;
grant execute on function public.release_expired_reservations() to service_role;

-- security definer so the uniqueness check sees every open order, not just
-- ones the calling (possibly customer-role) session's RLS would allow it
-- to select.
create or replace function public.generate_unique_payment_reference()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
begin
  loop
    v_ref := 'GK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    exit when not exists (
      select 1 from public.orders
      where payment_reference = v_ref
        and status not in ('approved', 'rejected', 'expired')
    );
  end loop;
  return v_ref;
end;
$$;

create or replace function public.generate_unique_amount(p_base numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric(10, 2);
begin
  loop
    v_amount := p_base + (floor(random() * 99) + 1) / 100.0;
    exit when not exists (
      select 1 from public.orders
      where amount_exact = v_amount
        and status not in ('approved', 'rejected', 'expired')
    );
  end loop;
  return v_amount;
end;
$$;
