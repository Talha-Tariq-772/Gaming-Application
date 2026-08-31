/**
 * Reserves /memberships' real footprint during its Suspense fallback and
 * route-level loading.tsx window. Every value below is a directly measured
 * real height (390/768/1440px, matching this route's own sm:/lg: grid
 * breakpoints) via a real headless-browser render against live data — not
 * an estimate. Re-measured after fixing two real wrap bugs this same
 * render surfaced (the h1 and the setup-guide grid — see MembershipsBody's
 * own comments). Re-measure again if the hero copy, product count, or
 * guide count changes.
 *
 * - Header: clamp(420px, 45vw, 620px), same deterministic formula as the
 *   game detail page's wallpaper — not measured, computed.
 * - Hero text block (eyebrow/title/subtitle): 196px @390 (the h1 is
 *   text-[1.75rem] below sm:, not text-display-sm — see MembershipsBody),
 *   253px @768, 237px @1440.
 * - Product grid: NOT a flat height — reproduces the real grid's own
 *   sm:grid-cols-2 lg:grid-cols-3 classes with 3 placeholder cards, so
 *   column reflow (3 stacked -> 2+1 -> one row of 3) happens for free
 *   instead of needing a separate hardcoded height per breakpoint.
 * - Setup guide section: 255px @390, 220px @768, 309px @1440 (flat
 *   height — same "just reserve the block" approach GameDetailSkeleton
 *   uses for its own setup-guide section, not a structural replica). Only
 *   one guide exists today, so the real section never applies
 *   sm:grid-cols-2 (MembershipsBody only adds that once guides.length > 1)
 *   — these numbers are for the single-column case.
 */
export default function MembershipsSkeleton() {
  return (
    <div>
      <div className="w-full bg-nova-crypt" style={{ height: "clamp(420px, 45vw, 620px)" }} />

      <div className="mx-auto max-w-page px-4 md:px-8">
        <div className="relative -mt-16 flex h-[196px] flex-col justify-center gap-3 pb-1 sm:-mt-20 md:-mt-24 md:h-[253px] md:pb-2 lg:h-[237px]">
          <div className="h-[11px] w-28 animate-pulse rounded-full bg-nova-slab" />
          <div className="h-9 w-full max-w-md animate-pulse rounded bg-nova-slab sm:h-10 lg:h-12" />
          <div className="mt-2 h-14 w-full max-w-2xl animate-pulse rounded bg-nova-slab" />
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-lg border border-nova-hairline bg-nova-crypt"
            >
              <div className="aspect-video w-full animate-pulse bg-nova-slab" />
              <div className="flex flex-col gap-4 p-6">
                <div className="h-6 w-2/3 animate-pulse rounded bg-nova-slab" />
                <div className="h-9 w-28 animate-pulse rounded bg-nova-slab" />
                <div className="h-11 w-32 animate-pulse rounded bg-nova-slab" />
              </div>
            </div>
          ))}
        </div>

        <div className="my-12 h-px w-full bg-nova-hairline" />

        <div className="h-[255px] max-w-3xl pb-16 md:h-[220px] lg:h-[309px]">
          <div className="h-[11px] w-20 animate-pulse rounded-full bg-nova-slab" />
          <div className="mt-4 h-24 w-full max-w-sm animate-pulse rounded-lg bg-nova-slab" />
        </div>
      </div>
    </div>
  );
}
