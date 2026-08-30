/**
 * Reserves HowItWorks's real footprint during the route-level loading.tsx
 * window — same border/padding/grid classes (including the sm:/lg:
 * column-count breakpoints, which is why mobile needs taller reserved
 * space than desktop: 4 stacked items vs. one row) so the reserved height
 * tracks HowItWorks.tsx's real height instead of a fixed guess.
 */
export default function HowItWorksSkeleton() {
  return (
    <section aria-hidden="true" className="border-y border-nova-hairline bg-nova-crypt">
      <div className="mx-auto max-w-page px-4 py-16 md:px-8">
        <div className="mb-10 h-8 w-48 animate-pulse rounded bg-nova-slab md:h-9" />
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex animate-pulse flex-col gap-3">
              <div className="h-10 w-10 rounded-full bg-nova-slab" />
              <div className="h-9 w-24 rounded bg-nova-slab" />
              {/* Description line-count grows as each grid column narrows
                  (1 col mobile -> 4 col desktop), same as the real text —
                  measured real per-item height: ~120-139px at 390px,
                  ~231px at 1440px (lg:grid-cols-4). */}
              <div className="h-12 w-full rounded bg-nova-slab lg:h-32" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
