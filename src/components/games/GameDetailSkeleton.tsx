/**
 * Reserves the Part B two-column redesign's real footprint during
 * app/(storefront)/games/[slug]'s route-level loading.tsx window. Every
 * value below is a directly measured real height (390/768/1440px), sized
 * to the single-variant path (ghost-of-yotei, with a description) since
 * 15 of the catalog's 16 games are variantMode='single' — same call the
 * pre-Part-B skeleton made. gta-vi (the one variantMode='multi' game,
 * whose variant-pill row makes its purchase block taller) will show a
 * bigger shift than everything else; sizing to gta-vi instead was tried
 * and measured *worse* overall (0.32 vs 0.20 CLS at 390px) because it
 * oversizes the skeleton for every other game's shorter real block —
 * matching the common case beats matching the outlier here.
 *
 * - Wallpaper: same clamp(420px, 45vw, 620px) formula as the real header
 *   and the store slider — deterministic, not measured.
 * - Hero row (cover + eyebrow/title): unchanged by Part B, still 232px
 *   @390 / 235px @768+ (the catalog's longest-title worst case — see git
 *   history for that measurement).
 * - Purchase block (order-1 on mobile/tablet, right column on desktop):
 *   price + full-width Add to Cart + stock-state line + trust-line list.
 *   Measured 239px @390, 249px @768, 261px @1440.
 * - Content block (order-2 on mobile/tablet, left column on desktop):
 *   description + genre/platform/release grid + collapsed setup guide.
 *   Measured 356px @390, 335px @768, 337px @1440.
 * - Below lg, the two stack (gap-10 = 40px between them); at lg+ they sit
 *   side by side, so only the taller of the two drives the row height.
 */
export default function GameDetailSkeleton() {
  return (
    <div>
      <div className="w-full bg-nova-crypt" style={{ height: "clamp(420px, 45vw, 620px)" }} />

      <div className="mx-auto max-w-page px-4 md:px-8">
        <div className="relative -mt-16 flex h-[232px] items-end gap-5 sm:-mt-20 sm:h-[235px] md:-mt-24 md:gap-8">
          <div className="aspect-3/4 w-28 shrink-0 animate-pulse rounded-lg bg-nova-slab sm:w-36 md:w-44" />
          <div className="flex flex-1 flex-col justify-end gap-2 pb-1 md:pb-2">
            <div className="h-[11px] w-24 animate-pulse rounded-full bg-nova-slab" />
            <div className="h-9 w-full animate-pulse rounded bg-nova-slab sm:h-12 md:h-14" />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-10 pb-16 md:mt-10 lg:grid-cols-[minmax(0,62%)_minmax(0,38%)] lg:items-start lg:gap-12">
          {/* Purchase column */}
          <div className="order-1 flex h-[239px] flex-col gap-4 sm:h-[249px] lg:order-2 lg:h-[261px]">
            <div className="h-9 w-40 animate-pulse rounded bg-nova-slab" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-nova-slab" />
            <div className="h-4 w-32 animate-pulse rounded-full bg-nova-slab" />
            <div className="mt-1 flex flex-col gap-2 border-t border-nova-hairline pt-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-3 w-48 animate-pulse rounded-full bg-nova-slab" />
              ))}
            </div>
          </div>

          {/* Content column */}
          <div className="order-2 flex h-[356px] max-w-3xl flex-col gap-8 sm:h-[335px] lg:order-1 lg:h-[337px]">
            <div className="flex flex-col gap-2">
              <div className="h-4 w-full animate-pulse rounded-full bg-nova-slab" />
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-nova-slab" />
            </div>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="h-[11px] w-14 animate-pulse rounded-full bg-nova-slab" />
                  <div className="h-6 w-20 animate-pulse rounded-full bg-nova-slab" />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-[11px] w-20 animate-pulse rounded-full bg-nova-slab" />
              <div className="h-14 w-full animate-pulse rounded-lg bg-nova-slab" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
