-- Fix: 20260831000003's guardrail blocked hard-deleting a game entirely,
-- not just removing individual variants while the game stays around.
-- game_variants.game_id references games(id) on delete cascade
-- (20260829000003_game_variants.sql), so deleting a game issues a real
-- DELETE against every one of its variant rows in the same statement — and
-- if a game had 2+ active variants, the trigger's own per-row check tripped
-- on the last one processed (the earlier rows in the same cascade had
-- already been removed by then, dropping the active count to <=1),
-- aborting the ENTIRE statement, including the games row itself. Caught by
-- this session's own test cleanup (tests/admin-variants.test.ts's afterAll)
-- silently failing to delete its test games.
--
-- Fix: skip the check when the game itself no longer exists. By the time a
-- cascade-triggered DELETE fires on a child game_variants row, the parent
-- games row has already been removed from the table within the same
-- transaction (command-counter-incremented, so visible to a plain SELECT
-- in the same statement) — a reliable way to tell "the whole game is going
-- away" from "a variant is being removed while the game stays".
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

  if not exists (select 1 from public.games where id = v_game_id) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

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
