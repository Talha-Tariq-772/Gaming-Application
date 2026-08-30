/**
 * Reserves HomeHero's real footprint during the route-level loading.tsx
 * window (see app/(storefront)/(home)/loading.tsx) — same grid/padding
 * classes as HomeHero.tsx so the reserved height tracks its real height at
 * every breakpoint instead of a hand-picked pixel value that drifts out of
 * sync the next time HomeHero's copy or spacing changes.
 */
export default function HomeHeroSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="mx-auto grid max-w-page gap-12 px-4 py-32 md:grid-cols-2 md:items-center md:px-8 md:py-48"
    >
      <div className="flex animate-pulse flex-col items-start justify-center gap-8">
        <div className="h-4 w-20 rounded bg-nova-slab" />
        <div className="h-[88px] w-full rounded bg-nova-slab" />
        <div className="h-14 w-full max-w-lg rounded bg-nova-slab" />
        <div className="flex items-center gap-6">
          <div className="h-11 w-32 rounded-full bg-nova-slab" />
          <div className="h-11 w-40 rounded-full bg-nova-slab" />
        </div>
      </div>
      <div className="aspect-square w-full animate-pulse rounded-lg bg-nova-crypt" />
    </section>
  );
}
