/**
 * Fallback for the <Suspense> around Footer (components/Footer.tsx) in
 * app/(storefront)/layout.tsx — Footer is an async Server Component
 * (awaits getPaymentMethods()) rendered as a sibling of {children} in the
 * shared layout, not inside `main`. Unwrapped, that async dependency held
 * up the *entire* layout's first paint on every route in this group —
 * Header and the page's own content included — until its query resolved,
 * which is what made every route-level loading.tsx fallback (including a
 * page-specific one) irrelevant: nothing in this layout could paint before
 * Footer did. Same isolation pattern as FeaturedGames/GamesResults —
 * matches Footer.tsx's real grid/padding classes so reserved height tracks
 * its real height at every breakpoint.
 */
export default function FooterSkeleton() {
  return (
    <footer aria-hidden="true" className="border-t border-nova-hairline bg-nova-void">
      <div className="mx-auto max-w-page px-4 py-24 md:px-8">
        <div className="mb-16 grid animate-pulse gap-8 border-b border-nova-hairline pb-16 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-20 rounded bg-nova-slab" />
              <div className="mt-3 h-4 w-32 rounded bg-nova-slab" />
            </div>
          ))}
        </div>

        <div className="grid animate-pulse gap-16 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <div className="h-6 w-20 rounded bg-nova-slab" />
            <div className="mt-4 h-10 w-full rounded bg-nova-slab" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-16 rounded bg-nova-slab" />
              <div className="mt-6 flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-4 w-20 rounded bg-nova-slab" />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-24 h-11 animate-pulse border-t border-nova-hairline pt-8" />
      </div>
    </footer>
  );
}
