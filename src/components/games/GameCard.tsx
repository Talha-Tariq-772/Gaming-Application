import Link from "next/link";
import NovaCard from "@/src/components/ui/nova/NovaCard";
import { formatPrice } from "@/src/lib/format";
import { priceDisplay } from "@/src/lib/price-display";
import { gameCoverImage } from "@/src/lib/storage-image";
import { GAME_PLATFORM_LABELS } from "@/src/types/database";
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
  const price = priceDisplay(game);
  const cover = game.coverPath ? gameCoverImage(game.coverPath) : null;

  return (
    <Link href={`/games/${game.slug}`} className="group flex flex-col gap-3">
      <NovaCard data-cursor-follow-target className="relative aspect-3/4 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- cover_path derivatives are already exact pre-sized .webp files (Session 1's upload script); next/image's optimizer would only re-fetch and re-encode them for no benefit — see storage-image.ts */}
        <img
          src={cover ? cover.src : game.coverImageUrl}
          srcSet={cover?.srcSet}
          sizes={cover ? "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw" : undefined}
          alt={game.title}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          className="absolute inset-0 h-full w-full scale-110 object-cover"
        />
      </NovaCard>
      <div className="flex flex-col gap-1.5">
        <h3 className="line-clamp-2 font-sans text-[15px] font-semibold uppercase tracking-[0.06em] text-nova-bone transition-colors duration-(--duration-fast) ease-standard group-hover:text-nova-ember">
          {game.title}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Tag>{game.genre}</Tag>
          {game.platform && <Tag>{GAME_PLATFORM_LABELS[game.platform]}</Tag>}
        </div>
        {price && (
          <span className="mt-1 flex items-baseline gap-2">
            <span className="text-sm font-semibold text-nova-bone">{price.label}</span>
            {price.wasPricePkr !== null && (
              <span className="text-xs text-nova-smoke line-through">
                {formatPrice(price.wasPricePkr)}
              </span>
            )}
          </span>
        )}
      </div>
    </Link>
  );
}
