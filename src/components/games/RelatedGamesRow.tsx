import GameCard from "@/src/components/games/GameCard";
import FeaturedGamesScroll from "@/src/components/home/FeaturedGamesScroll";
import { getGames } from "@/src/lib/catalog";
import type { Game } from "@/src/types/database";

const RELATED_COUNT = 8;
const MIN_GENRE_MATCHES = 3;

/**
 * "More <Genre>" below the fold on a game detail page — same pinned
 * horizontal-scroll row as the homepage's Featured/Best Sellers/New
 * Arrivals sections (FeaturedGamesScroll), not a second implementation.
 *
 * Below MIN_GENRE_MATCHES, this KEEPS whatever same-genre matches exist
 * (there may be 1 or 2 — discarding them and showing an unrelated list
 * instead would throw away a real, honest match) and pads the remainder
 * with other games, relabeling the heading "More Games" since the result
 * is then a mixed list, not a pure genre match. Renders nothing at all if
 * even that fallback can't find a single other game — never an empty
 * heading or empty carousel.
 */
export default async function RelatedGamesRow({ game }: { game: Game }) {
  const sameGenre = (await getGames({ genre: [game.genre] })).filter((g) => g.id !== game.id);

  let heading = `More ${game.genre}`;
  let related: Game[] = sameGenre;

  if (sameGenre.length < MIN_GENRE_MATCHES) {
    const sameGenreIds = new Set(sameGenre.map((g) => g.id));
    const others = (await getGames()).filter((g) => g.id !== game.id && !sameGenreIds.has(g.id));
    heading = "More Games";
    related = [...sameGenre, ...others];
  }

  if (related.length === 0) return null;

  return (
    <FeaturedGamesScroll
      heading={
        <h2 className="mb-8 font-display text-2xl font-bold text-nova-bone">{heading}</h2>
      }
    >
      {related.slice(0, RELATED_COUNT).map((g) => (
        <div key={g.id} className="w-56 shrink-0 snap-start sm:w-64">
          <GameCard game={g} />
        </div>
      ))}
    </FeaturedGamesScroll>
  );
}
