-- Catalog columns for the store rebuild. Additive only — price stays on
-- this table for now (see 20260829000003_game_variants.sql for why) and
-- nothing here is dropped or renamed.
alter table public.games
  add column product_type text not null default 'game' check (product_type in ('game', 'membership')),
  add column release_date date,
  add column is_new_arrival boolean not null default false,
  add column is_best_seller boolean not null default false,
  add column variant_mode text not null default 'single' check (variant_mode in ('single', 'multi')),
  add column cover_path text,
  add column wallpaper_path text,
  add column slider_position smallint,
  add column setup_guide_id uuid;

-- `platform` already existed as free text (see 20260818000002_games.sql)
-- with no constraint, written by the admin form using the GAME_PLATFORMS
-- enum in src/types/database.ts. Checked the live table directly before
-- writing this (`select id, slug, platform from games`, 2026-08-30): all
-- existing rows have platform = null, so there's nothing to normalize
-- today — but the three values below are the only non-null values that
-- form has ever been able to write, so they're normalized defensively in
-- case a row was created between that check and this migration actually
-- running.
update public.games
set platform = case platform
  when 'PlayStation 5' then 'ps5'
  when 'Xbox Series X' then 'xbox'
  when 'Xbox One' then 'xbox'
  else platform
end
where platform in ('PlayStation 5', 'Xbox Series X', 'Xbox One');

-- 'PC' and 'Nintendo Switch' (the other two GAME_PLATFORMS values) have no
-- corresponding value in the new ps4/ps5/ps4_ps5/xbox set — there is no
-- correct value to normalize them to. Fail loudly with the actual
-- offending values instead of silently nulling real data or letting the
-- ADD CONSTRAINT below fail with an opaque constraint-violation error.
do $$
declare
  v_bad_count integer;
  v_bad_values text;
begin
  select count(*), string_agg(distinct platform, ', ')
  into v_bad_count, v_bad_values
  from public.games
  where platform is not null
    and platform not in ('ps4', 'ps5', 'ps4_ps5', 'xbox');

  if v_bad_count > 0 then
    raise exception 'games.platform has % row(s) with values that do not map to ps4/ps5/ps4_ps5/xbox and were not normalized: %. Add a mapping for these values above before re-running this migration.', v_bad_count, v_bad_values;
  end if;
end $$;

-- Narrowing `platform` to the four real catalog values; `is null` keeps
-- unset rows valid.
alter table public.games
  add constraint games_platform_check check (platform is null or platform in ('ps4', 'ps5', 'ps4_ps5', 'xbox'));

-- `genre` (also pre-existing free text, also previously unconstrained) had
-- the same class of risk as platform, just not yet triggered by a CHECK:
-- GAME_GENRES only had 9 values with no Sports/Fighting, while the seed
-- (20260829000004_seed_catalog.sql) uses both for real games — so editing
-- one of those two games through the admin form would have silently
-- rewritten its genre the first time someone touched it, with no error to
-- notice by. GAME_GENRES is now the union of both lists (11 values); this
-- constraint enforces that same union rather than just the 7 the seed
-- actually uses, so a future admin-created game can still legitimately be
-- Adventure/Strategy/Puzzle/Simulation even though none of today's 16 are.
--
-- Checked the live table directly first (`select id, slug, genre from
-- games`, 2026-08-30): all 36 existing rows have genre = null too, so
-- there's nothing to normalize — this is a pure add, not a remap, unlike
-- platform above. Still guarding first rather than assuming that stays
-- true, same reasoning as platform's DO block.
do $$
declare
  v_bad_count integer;
  v_bad_values text;
begin
  select count(*), string_agg(distinct genre, ', ')
  into v_bad_count, v_bad_values
  from public.games
  where genre is not null
    and genre not in ('Action', 'Adventure', 'RPG', 'Racing', 'Shooter', 'Strategy', 'Puzzle', 'Simulation', 'Horror', 'Sports', 'Fighting');

  if v_bad_count > 0 then
    raise exception 'games.genre has % row(s) with values outside the reconciled GAME_GENRES set: %. Add these to GAME_GENRES (src/types/database.ts) and this constraint together before re-running this migration.', v_bad_count, v_bad_values;
  end if;
end $$;

alter table public.games
  add constraint games_genre_check check (genre is null or genre in ('Action', 'Adventure', 'RPG', 'Racing', 'Shooter', 'Strategy', 'Puzzle', 'Simulation', 'Horror', 'Sports', 'Fighting'));

comment on column public.games.cover_path is
  'Object path prefix inside the game-images bucket, no size suffix or extension. Games: "covers/{slug}" — actual objects are "{cover_path}-400.webp" and "{cover_path}-800.webp". Null for memberships (no cover art in this catalog, only a header image via wallpaper_path).';

comment on column public.games.wallpaper_path is
  'Object path prefix, no size suffix or extension. Games (game-images bucket): "wallpapers/{slug}" -> "{wallpaper_path}-640.webp" / "-1280.webp" / "-1920.webp". Memberships (membership-images bucket): "{slug}/header" -> same three widths.';

comment on column public.games.setup_guide_id is
  'Nullable FK-shaped column, no FK constraint yet: the guides table this will reference does not exist as of this migration. Populated in a later session.';

comment on column public.games.slider_position is
  'Homepage hero slider order, 1-based. Null means not in the slider.';
