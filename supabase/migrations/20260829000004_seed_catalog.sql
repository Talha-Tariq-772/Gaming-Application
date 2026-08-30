-- Seeds the 16 games + 3 memberships for the store rebuild. games.price is
-- set to each item's base/first variant price purely to satisfy the
-- existing NOT NULL/>0 check on that legacy column (see
-- 20260829000003_game_variants.sql) — game_variants below is the real price
-- source. platform is left null: no data was supplied for it, and this
-- session doesn't guess.
--
-- genre uses a small fixed set (Action, RPG, Shooter, Sports, Racing,
-- Horror, Fighting) rather than one invented label per game — Session 2's
-- filter bar needs genre populated. GAME_GENRES (src/types/database.ts) and
-- games_genre_check (20260829000002_games_catalog_columns.sql) were both
-- reconciled to the union of this set and the admin form's pre-existing
-- one, so Sports/Fighting round-trip through the admin form correctly —
-- see that migration's comment for why this needed fixing at all.
--
-- release_date years/dates are real. gta-vi and fc-27 are unreleased as of
-- this migration — gta-vi uses Rockstar's last publicly confirmed date as
-- of this session's knowledge, fc-27 uses an estimate following EA's
-- annual September/October cadence (no official date exists yet). Both
-- should be double-checked against current announcements before shipping.
--
-- cover_path/wallpaper_path values are prefixes only (see column comments
-- on public.games), matching the object paths written by
-- scripts/upload-catalog-images.mjs. That script also uploads a
-- membership-images-bucket-root "header-{640,1280,1920}.webp" (from the
-- generic public/membership/header.jpeg) that isn't tied to any single
-- game row — not referenced here.
insert into public.games
  (title, slug, price, product_type, variant_mode, genre, release_date, cover_path, wallpaper_path, slider_position)
values
  ('Grand Theft Auto VI', 'gta-vi', 4999, 'game', 'multi', 'Action', '2026-11-19', 'covers/gta-vi', 'wallpapers/gta-vi', 1),
  ('Ghost of Yotei', 'ghost-of-yotei', 4000, 'game', 'single', 'Action', '2025-10-02', 'covers/ghost-of-yotei', 'wallpapers/ghost-of-yotei', 2),
  ('Battlefield 6', 'battlefield-6', 3900, 'game', 'single', 'Shooter', '2025-10-10', 'covers/battlefield-6', 'wallpapers/battlefield-6', 3),
  ('Black Myth: Wukong', 'black-myth-wukong', 7500, 'game', 'single', 'Action', '2024-08-20', 'covers/black-myth-wukong', 'wallpapers/black-myth-wukong', 4),
  ('Call of Duty: Black Ops 6', 'cod-black-ops-6', 2500, 'game', 'single', 'Shooter', '2024-10-25', 'covers/cod-black-ops-6', 'wallpapers/cod-black-ops-6', 5),
  ('EA Sports FC 27', 'fc-27', 2500, 'game', 'single', 'Sports', '2026-09-25', 'covers/fc-27', 'wallpapers/fc-27', null),
  ('EA Sports FC 26', 'fc-26', 2500, 'game', 'single', 'Sports', '2025-09-26', 'covers/fc-26', 'wallpapers/fc-26', null),
  ('Need for Speed Unbound', 'need-for-speed-unbound', 2500, 'game', 'single', 'Racing', '2022-12-02', 'covers/need-for-speed-unbound', 'wallpapers/need-for-speed-unbound', null),
  ('Assassin''s Creed Valhalla', 'assassins-creed-valhalla', 2500, 'game', 'single', 'RPG', '2020-11-10', 'covers/assassins-creed-valhalla', 'wallpapers/assassins-creed-valhalla', null),
  ('Call of Duty: Modern Warfare II', 'cod-modern-warfare-2', 3800, 'game', 'single', 'Shooter', '2022-10-28', 'covers/cod-modern-warfare-2', 'wallpapers/cod-modern-warfare-2', null),
  ('Dragon Ball: Sparking! Zero', 'dragon-ball-sparking-zero', 3500, 'game', 'single', 'Fighting', '2024-10-11', 'covers/dragon-ball-sparking-zero', 'wallpapers/dragon-ball-sparking-zero', null),
  ('Silent Hill 2', 'silent-hill-2', 3000, 'game', 'single', 'Horror', '2024-10-08', 'covers/silent-hill-2', 'wallpapers/silent-hill-2', null),
  ('Marvel''s Spider-Man 2', 'spider-man-2', 3500, 'game', 'single', 'Action', '2023-10-20', 'covers/spider-man-2', 'wallpapers/spider-man-2', null),
  ('Hogwarts Legacy', 'hogwarts-legacy', 3000, 'game', 'single', 'RPG', '2023-02-10', 'covers/hogwarts-legacy', 'wallpapers/hogwarts-legacy', null),
  ('Remnant II', 'remnant-2', 2500, 'game', 'single', 'Shooter', '2023-07-25', 'covers/remnant-2', 'wallpapers/remnant-2', null),
  ('Dead Island 2', 'dead-island-2', 2500, 'game', 'single', 'Action', '2023-04-21', 'covers/dead-island-2', 'wallpapers/dead-island-2', null),
  ('PlayStation Plus', 'playstation-plus', 10000, 'membership', 'single', null, null, null, 'playstation-plus/header', null),
  ('PS Plus Extra & Premium', 'ps-plus-extra-premium', 1500, 'membership', 'single', null, null, null, 'ps-plus-extra-premium/header', null),
  ('Xbox Game Pass Ultimate', 'xbox-game-pass-ultimate', 1800, 'membership', 'single', null, null, null, 'xbox-game-pass-ultimate/header', null)
on conflict (slug) do nothing;

-- price_source='catalog' only where the WhatsApp catalog confirmed the
-- number; everything else is 'estimate'.
--
-- playstation-plus's 10000 IS from the catalog, but it sits oddly next to
-- PS+ Extra & Premium at 1500 for the same "1 Month" shape — it may
-- actually be a 12-month price rather than 1-month. Flagging rather than
-- guessing at a fix; see the verification report for the full
-- price_source='estimate' list to take to Hashir, and raise this row too.
insert into public.game_variants (game_id, label, price_pkr, was_price_pkr, price_source, sort_order)
select g.id, v.label, v.price_pkr, v.was_price_pkr, v.price_source, v.sort_order
from (
  values
    ('gta-vi', 'Standard', 4999, null::integer, 'catalog', 1::smallint),
    ('gta-vi', 'Ultimate', 5499, null::integer, 'catalog', 2::smallint),
    ('fc-27', 'Standard', 2500, null::integer, 'catalog', 1::smallint),
    ('fc-26', 'Standard', 2500, null::integer, 'catalog', 1::smallint),
    ('ghost-of-yotei', 'Standard', 4000, 19500, 'catalog', 1::smallint),
    ('need-for-speed-unbound', 'Standard', 2500, null::integer, 'catalog', 1::smallint),
    ('assassins-creed-valhalla', 'Standard', 2500, null::integer, 'catalog', 1::smallint),
    ('black-myth-wukong', 'Standard', 7500, 15500, 'catalog', 1::smallint),
    ('cod-modern-warfare-2', 'Standard', 3800, null::integer, 'catalog', 1::smallint),
    ('battlefield-6', 'Standard', 3900, 19500, 'catalog', 1::smallint),
    ('cod-black-ops-6', 'Standard', 2500, null::integer, 'catalog', 1::smallint),
    ('dragon-ball-sparking-zero', 'Standard', 3500, null::integer, 'catalog', 1::smallint),
    ('silent-hill-2', 'Standard', 3000, null::integer, 'catalog', 1::smallint),
    ('ps-plus-extra-premium', '1 Month', 1500, null::integer, 'catalog', 1::smallint),
    ('playstation-plus', 'Standard', 10000, null::integer, 'catalog', 1::smallint),
    ('spider-man-2', 'Standard', 3500, null::integer, 'estimate', 1::smallint),
    ('hogwarts-legacy', 'Standard', 3000, null::integer, 'estimate', 1::smallint),
    ('remnant-2', 'Standard', 2500, null::integer, 'estimate', 1::smallint),
    ('dead-island-2', 'Standard', 2500, null::integer, 'estimate', 1::smallint),
    ('xbox-game-pass-ultimate', '1 Month', 1800, null::integer, 'estimate', 1::smallint)
) as v(slug, label, price_pkr, was_price_pkr, price_source, sort_order)
join public.games g on g.slug = v.slug
on conflict (game_id, label) do update set
  price_pkr = excluded.price_pkr,
  was_price_pkr = excluded.was_price_pkr,
  price_source = excluded.price_source,
  sort_order = excluded.sort_order;
