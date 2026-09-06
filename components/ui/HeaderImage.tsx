import Image from "next/image";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { getHeaderImage } from "@/lib/product-image";
import type { Game } from "@/src/types/database";

// A caller not backed by a Game row (e.g. a gift-card product) can pass a
// plain absolute headerImageUrl instead — see lib/product-image.ts's
// getHeaderImageResponsive, which resolves this variant before ever
// touching wallpaperPath/Storage.
type HeaderGame =
  | Pick<Game, "slug" | "wallpaperPath" | "productType">
  | { slug: string; wallpaperPath: null; headerImageUrl: string }
  | { slug: string; wallpaperPath: null };

/**
 * Game-detail header art, shown at its native aspect ratio: the wrapper is
 * `aspect-[12/5]` (2.4:1, matching the source artwork — the header art was
 * re-shot at 2880x1200/similar after this was originally built at 16:9),
 * so `object-cover` fills it exactly with zero cropping and no letterbox
 * gap. `fill` (rather than intrinsic width/height) is what lets the image
 * stretch to whatever box the wrapper ends up with. No parallax: any
 * scroll-driven transform here would reintroduce layout shift.
 *
 * Two small, tightly-scoped gradients only — see the two divs below —
 * never a full-width wash: the center/right of the artwork (the
 * characters) must always stay completely untouched.
 */
export default function HeaderImage({
  game,
  className,
  style,
  children,
  ...rest
}: {
  game: HeaderGame;
  className?: string;
  style?: CSSProperties;
  /** Page-specific decoration layered inside the same reserved,
   * overflow-hidden box — rendered above the image. */
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"div">, "style" | "className" | "children">) {
  const src = getHeaderImage(game);

  return (
    <div className={`relative aspect-[12/5] w-full overflow-hidden ${className ?? ""}`} style={style} {...rest}>
      <Image
        src={src}
        alt=""
        fill
        unoptimized
        sizes="100vw"
        priority
        fetchPriority="high"
        className="object-cover object-center"
      />
      {/* Text scrim: left ~40% only, where GameDetailBody's overlapping
          cover+title row sits — fades to fully transparent before
          mid-frame, leaving the center/right of the artwork untouched.
          Hardcoded dark color (not the nova-void token) so it stays the
          same dark scrim in both themes, never a light/fog wash. Capped
          at 70% opacity at its darkest point. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-[#08060a]/70 via-[#08060a]/30 to-transparent"
      />
      {/* Bottom blend: thin band so the hero merges into the page content
          below (the overlapping cover+title row, then the rest of the
          page) — uses the nova-void token on purpose, unlike the scrim
          above, since this one's job is to match each theme's actual
          page background at the seam. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/5 bg-gradient-to-t from-nova-void to-transparent"
      />
      {children}
    </div>
  );
}
