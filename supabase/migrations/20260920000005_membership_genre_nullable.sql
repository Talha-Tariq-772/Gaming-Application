-- Genre is meaningful for a game and meaningless for a subscription.
--
-- games.genre was already nullable at the column level (games_genre_check
-- has always allowed NULL), and all three membership products shipped with
-- NULL. What was missing was any rule saying so: the admin form treated
-- genre as unconditionally required, and because a controlled
-- <select value={null}> still displays the first option, the form silently
-- fell back to "Action". That wrote a genre onto PS Plus Extra & Premium
-- that nobody chose.
--
-- This migration makes the intent explicit in both directions:
--   * clear the value that fallback wrote
--   * constrain genre so it is REQUIRED for a game and OPTIONAL for a
--     membership, rather than leaving it up to whatever the UI does

-- 1. Undo the accidental write. Scoped to memberships rather than that one
--    slug so a re-run also catches any other membership the old fallback
--    reached before this shipped.
update public.games
   set genre = null
 where product_type = 'membership'
   and genre is not null;

-- 2. The rule the app can now rely on. Every game-type row already has a
--    genre (verified before writing this), so this validates immediately.
--    NOT VALID is deliberately NOT used: a constraint that isn't enforced
--    against existing rows would let this drift straight back.
alter table public.games
  add constraint games_genre_required_for_game_check check (
    product_type <> 'game' or genre is not null
  );

comment on constraint games_genre_required_for_game_check on public.games is
  'Genre is required for product_type=game and must stay NULL-able for memberships, which have no genre. Enforced here so the form is not the only thing holding the line.';
