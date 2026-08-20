-- payment_reference has a global UNIQUE constraint (see
-- 20260818000005_orders.sql), but the original generate_unique_payment_reference()
-- only checked collisions against open orders. A generated reference could
-- theoretically match a long-closed order's reference and fail the insert.
-- Checking against all rows matches what the constraint actually enforces —
-- cheap regardless of table size since payment_reference is indexed by the
-- UNIQUE constraint itself.
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
    );
  end loop;
  return v_ref;
end;
$$;
