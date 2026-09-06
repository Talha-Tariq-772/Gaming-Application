/**
 * Reserves HomeHero's real footprint during the route-level loading.tsx
 * window (see app/(storefront)/(home)/loading.tsx) — same wrapper
 * dimensions as HomeHero.tsx (aspect-[12/5] full-bleed image, plus the
 * mobile-only stacked copy band below it) so the reserved height tracks
 * the real height at every breakpoint instead of a hand-picked pixel
 * value that drifts out of sync the next time HomeHero's layout changes.
 */
export default function HomeHeroSkeleton() {
  return (
    <section aria-hidden="true" className="w-full overflow-hidden bg-nova-void">
      <div className="aspect-[12/5] w-full animate-pulse bg-nova-crypt" />
      {/* Mirrors the real mobile-only stacked copy band below the image —
          same padding/gap so its height matches, even though this
          skeleton doesn't need the actual text content. */}
      <div className="flex w-full flex-col items-start gap-7 bg-[#08060a] px-4 py-10 md:hidden">
        <div className="h-4 w-20 animate-pulse rounded bg-nova-slab" />
        <div className="h-[88px] w-full animate-pulse rounded bg-nova-slab" />
        <div className="h-14 w-full animate-pulse rounded bg-nova-slab" />
        <div className="flex items-center gap-6">
          <div className="h-11 w-32 animate-pulse rounded-full bg-nova-slab" />
          <div className="h-11 w-40 animate-pulse rounded-full bg-nova-slab" />
        </div>
      </div>
    </section>
  );
}
