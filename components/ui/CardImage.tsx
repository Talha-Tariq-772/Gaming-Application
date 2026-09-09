import Image from "next/image";
import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { getCardImage, getCardImageDimensions } from "@/lib/product-image";
import type { Game } from "@/src/types/database";

const CARD_SIZES = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

type CardGame = Pick<Game, "slug" | "title" | "coverPath" | "coverImageUrl">;

/**
 * Zero-CLS product card art. The wrapper reserves its box via an explicit
 * CSS aspect-ratio (3/4) before the image ever loads — width/height on the
 * <Image> itself are the true source pixel dimensions (see
 * lib/product-image.ts), used only for the intrinsic-size hint, since
 * `unoptimized` + the absolute-fill className below mean the wrapper's
 * aspect-ratio is what actually governs layout.
 *
 * `unoptimized`: Cloudflare Pages doesn't run next/image's optimizer, and
 * every source here is already a correctly-sized static file or an
 * already-sized Storage derivative (storage-image.ts) — there's nothing
 * for the optimizer to do but add a redundant round trip.
 *
 * Hover zoom reacts to the AMBIENT `group` class (plain, unnamed) — the
 * card root/Link wrapping this component, not a group declared here. That
 * makes the zoom fire for hovering anywhere on the card (GameCard's Link
 * already carries `group`), while a caller with no `group` ancestor (e.g.
 * GameDetailBody's static cover thumbnail) simply never triggers it — no
 * per-call-site opt-out needed. `overflow-hidden` on this wrapper clips
 * the scaled image to the card's own bounds, and the scale is a CSS
 * transform, so it never shifts grid layout.
 */
export default function CardImage({
  game,
  priority = false,
  className,
  style,
  ...rest
}: {
  game: CardGame;
  /** First row of a catalog grid is the LCP candidate — skip lazy-loading
   * for it, same reasoning GameCard.tsx's own `priority` prop documented. */
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
} & Omit<ComponentPropsWithoutRef<"div">, "style" | "className" | "children">) {
  const src = getCardImage(game);
  const { width, height } = getCardImageDimensions(game);

  return (
    <div
      // cardimage-w-full (app/globals.css), not Tailwind's w-full: see that
      // rule's comment — a caller's own width override (e.g. w-28 sm:w-36
      // md:w-44) must always win, and layering the default in `base`
      // guarantees that regardless of Tailwind's generation order.
      className={`relative aspect-3/4 cardimage-w-full overflow-hidden ${className ?? ""}`}
      style={style}
      {...rest}
    >
      <Image
        src={src}
        alt={game.title}
        width={width}
        height={height}
        unoptimized
        sizes={CARD_SIZES}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-out motion-reduce:transition-none group-hover:scale-105 motion-reduce:group-hover:scale-100"
      />
      {/* Bottom-anchored scrim for title legibility over the art. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(8,6,10,0.85)_100%)]"
      />
      {/* Ember inset border, ignites to full opacity on hover. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 border border-nova-ember/30 transition-colors duration-400 group-hover:border-nova-ember"
      />
    </div>
  );
}
