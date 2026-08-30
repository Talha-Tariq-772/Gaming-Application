/**
 * Reserves the game detail page's real footprint during
 * app/(storefront)/games/[slug]'s route-level loading.tsx window — same
 * wrapper/grid classes as the real page (mx-auto max-w-page px-4 py-16
 * md:px-8, grid gap-12 md:grid-cols-2), so CSS grid's default row-stretch
 * does the desktop column-height alignment automatically: col1's
 * placeholder only needs to match its own real content height and CSS grid
 * stretches it to match col0's aspect-3/4 cover at 768px+, no separate
 * desktop-specific column height needed. The cover itself uses the same
 * aspect-3/4 class as the real <Image fill> container, so it already
 * tracks column width correctly at any viewport too.
 *
 * Every other value below is a directly measured real height (390px /
 * 1440px), not an estimate — title text-display-sm wraps to a
 * surprisingly tall block (121px / 133px, not the ~40px a "heading" guess
 * would assume) which was the single biggest gap the old generic skeleton
 * missed. The description paragraph is empty for every currently-seeded
 * game, so nothing is reserved for it — if that changes, re-measure.
 */
export default function GameDetailSkeleton() {
  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <div className="grid animate-pulse gap-12 md:grid-cols-2">
        <div className="relative aspect-3/4 overflow-hidden rounded-lg border border-nova-hairline bg-nova-crypt" />

        <div className="flex flex-col gap-6">
          <div>
            <div className="h-[121px] w-4/5 rounded bg-nova-crypt md:h-[133px]" />
            <div className="mt-4 flex gap-2">
              <div className="h-[26px] w-16 rounded-full bg-nova-crypt md:h-[27px]" />
              <div className="h-[26px] w-20 rounded-full bg-nova-crypt md:h-[27px]" />
            </div>
          </div>

          <div className="h-[43px] w-32 rounded bg-nova-crypt md:h-[58px]" />

          <div className="h-11 w-full rounded-md bg-nova-crypt" />

          <div className="h-[53px] w-full rounded-lg bg-nova-crypt md:h-[55px]" />
        </div>
      </div>
    </div>
  );
}
