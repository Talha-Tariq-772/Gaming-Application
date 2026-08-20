import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/src/lib/format";
import type { Game } from "@/src/types/database";
import Tag from "./Tag";

/**
 * Server component — no client JS of its own. The cursor-follow parallax
 * on the cover image is applied by a single delegated listener on the
 * grid container (see use-grid-cursor-follow.ts), not per-card; the
 * data-cursor-follow-target marker below is just how that listener finds
 * which card is under the pointer via closest(). Rendering 8+ of these in
 * a grid used to mean 8+ client-component boundaries hydrating for a
 * hover effect that can never even fire on the touch devices most of
 * those hydrations were for.
 */
export default function GameCard({
  game,
  priority = false,
}: {
  game: Game;
  /** First row of the grid should skip lazy-loading — it's the LCP
   * candidate on every catalog/results page, and lazy-loading it delays
   * LCP for no benefit since it's already above the fold. */
  priority?: boolean;
}) {
  return (
    <Link href={`/games/${game.slug}`} className="group flex flex-col gap-3">
      <div
        data-cursor-follow-target
        className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-surface-1"
      >
        <Image
          src={game.coverImageUrl}
          alt={game.title}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
          className="scale-110 object-cover"
          priority={priority}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="line-clamp-2 break-words font-display text-lg font-bold text-text transition-colors duration-(--duration-fast) ease-standard group-hover:text-accent">
          {game.title}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Tag>{game.genre}</Tag>
          <Tag>{game.platform}</Tag>
        </div>
        <span className="mt-1 text-sm font-semibold text-text">
          {formatPrice(game.price)}
        </span>
      </div>
    </Link>
  );
}
