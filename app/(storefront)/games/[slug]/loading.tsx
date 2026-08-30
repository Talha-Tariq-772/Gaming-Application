import GameDetailSkeleton from "@/src/components/games/GameDetailSkeleton";

/**
 * Overrides the generic app/(storefront)/loading.tsx for game detail pages
 * — same reasoning as /games and the homepage's own overrides: the generic
 * ~500px fallback doesn't reserve anywhere close to this route's real
 * height (~990-1030px, cover + title + tags + price + CTA + setup guide).
 * Both real images on this page (the cover here, the trailer poster in
 * TrailerEmbed.tsx) already use next/image `fill` inside an aspect-ratio
 * container, so neither one is a source of shift on its own regardless of
 * load timing — confirmed by inspecting both, not assumed. The residual
 * shift this route showed was the same generic-loading.tsx-vs-real-content
 * mismatch as every other route in this group, just proportionally smaller
 * (and therefore intermittent, depending on exact timing) because this
 * page's real content is comparatively compact.
 */
export default function Loading() {
  return <GameDetailSkeleton />;
}
