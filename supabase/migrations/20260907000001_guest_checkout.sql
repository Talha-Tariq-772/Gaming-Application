-- Guest checkout: orders no longer require a signed-in user. user_id
-- becomes nullable and a new guest_phone column (E.164, via
-- src/lib/phone.ts's normalisePhone) takes its place for guest orders.
-- Every order still has *some* way to reach the buyer — enforced by the
-- check constraint below, not just app-level discipline.
alter table public.orders alter column user_id drop not null;

alter table public.orders add column guest_phone text;

alter table public.orders
  add constraint orders_user_or_guest_chk
  check (user_id is not null or guest_phone is not null);

-- payment_reference format: PSC-XXXXXX (6 chars, unambiguous alphabet —
-- no 0/O/1/I/L) replaces the old GK-XXXX (4 hex chars) generator, going
-- forward only. Existing GK- rows are intentionally left untouched: those
-- references already exist in real WhatsApp threads/screenshots, and
-- regenerating them would break the exact-lookup this feature exists to
-- support. Admin search (src/components/admin/AdminOrdersClient.tsx)
-- strips either prefix, so both formats remain findable.
--
-- This also fixes a latent production bug: the previous version only
-- checked collisions against orders NOT in a terminal status, but
-- payment_reference carries a global UNIQUE constraint — a generated
-- value matching any closed order's reference (however old) would fail
-- the insert with a raw unique-violation instead of retrying. This
-- version checks every row, and bounds its retry loop so a pathological
-- run fails loudly (a clear exception) instead of looping forever.
create or replace function public.generate_unique_payment_reference()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; -- excludes 0, O, 1, I, L
  v_ref text;
  v_attempt int := 0;
  v_max_attempts constant int := 20;
begin
  loop
    v_attempt := v_attempt + 1;
    v_ref := 'PSC-' || (
      select string_agg(substr(v_alphabet, (floor(random() * length(v_alphabet)) + 1)::int, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (
      select 1 from public.orders where payment_reference = v_ref
    );
    if v_attempt >= v_max_attempts then
      raise exception 'REFERENCE_GENERATION_EXHAUSTED';
    end if;
  end loop;
  return v_ref;
end;
$$;

-- create_order(): p_user_id is now nullable (guest checkout). The
-- trailing p_guest_phone param carries an already-normalised E.164 phone
-- number for a guest order. When p_user_id IS set, behavior is
-- byte-for-byte identical to before — phone number still written onto
-- the profile row, guest_phone stays null. Dropped and recreated rather
-- than left as a CREATE OR REPLACE, matching this file's own established
-- convention (20260820000001_multi_item_orders.sql) for an arity change.
drop function if exists public.create_order(uuid, jsonb, text);

create or replace function public.create_order(
  p_user_id uuid,
  p_items jsonb,
  p_phone_number text,
  p_guest_phone text default null
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
  if p_user_id is null and p_guest_phone is null then
    raise exception 'GUEST_PHONE_REQUIRED';
  end if;

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

revoke all on function public.create_order(uuid, jsonb, text, text) from public;
grant execute on function public.create_order(uuid, jsonb, text, text) to service_role;
