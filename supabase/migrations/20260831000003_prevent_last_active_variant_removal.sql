-- Guardrail: a game must always keep at least one active variant. The
-- storefront (VariantPicker, AddToCartButton, getGameStock, priceDisplay)
-- has no fallback for a game whose active variant list goes empty — it's
-- the same "price data must exist" invariant games.price used to be, now
-- moved onto game_variants.
--
-- Same shape and reasoning as trg_prevent_last_admin_demotion
-- (20260830000001_prevent_last_admin_demotion.sql): setVariantActive
-- (src/lib/actions/admin-variants.ts) already checks this with a fast,
-- friendly SELECT-then-UPDATE before ever writing, but that check is
-- advisory only — no locking, so it can't by itself stop two concurrent
-- deactivations of two different variants on the same game from both
-- reading "2 active" and both succeeding. This trigger is the real
-- boundary: it locks every active variant row for the game before
-- counting, the same way the admin trigger locks every admin row before
-- counting.
--
-- Covers DELETE too, not just UPDATE — nothing in this session hard-deletes
-- a variant (admin-variants.ts only ever deactivates), but the invariant
-- should hold regardless of how a row goes away, including a future
-- feature or a one-off service-role script.
create or replace function public.prevent_last_active_variant_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_active_count integer;
begin
  if tg_op = 'DELETE' then
    if old.is_active is distinct from true then
      return old;
    end if;
    v_game_id := old.game_id;
  else
    if old.is_active is distinct from true or new.is_active is not distinct from true then
      return new;
    end if;
    v_game_id := old.game_id;
  end if;

  -- Lock every currently-active variant row for this game (the row being
  -- updated/deleted is itself active, so it's included) before counting —
  -- serializes concurrent deactivations on the same game instead of letting
  -- both read a stale "still 2 active" snapshot.
  perform 1 from public.game_variants where game_id = v_game_id and is_active = true order by id for update;

  select count(*) into v_active_count from public.game_variants where game_id = v_game_id and is_active = true;

  if v_active_count <= 1 then
    raise exception 'A game must keep at least one active variant'
      using errcode = 'LV001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger trg_prevent_last_active_variant_update
  before update on public.game_variants
  for each row execute function public.prevent_last_active_variant_removal();

create trigger trg_prevent_last_active_variant_delete
  before delete on public.game_variants
  for each row execute function public.prevent_last_active_variant_removal();
