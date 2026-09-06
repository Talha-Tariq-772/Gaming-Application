/**
 * Reserves GiftCardDetailBody's real footprint during the route's
 * loading.tsx / Suspense window. Structurally mirrors GameDetailSkeleton
 * (header + overlapping cover/title row + two-column body), simplified for
 * a gift card's much shorter content (no trailer, no setup guide, no
 * related-items row). Not measured against real render timings the way
 * GameDetailSkeleton's px values were — a reasonable approximation using
 * the same clamp()'d header height as HeaderImage's real aspect-[12/5] box.
 */
export default function GiftCardDetailSkeleton() {
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
          <div className="order-1 flex h-[180px] flex-col gap-4 lg:order-2">
            <div className="h-9 w-40 animate-pulse rounded bg-nova-slab" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-nova-slab" />
          </div>

          <div className="order-2 flex h-[200px] max-w-3xl flex-col gap-8 lg:order-1">
            <div className="flex flex-col gap-2">
              <div className="h-4 w-full animate-pulse rounded-full bg-nova-slab" />
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-nova-slab" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-[11px] w-32 animate-pulse rounded-full bg-nova-slab" />
              <div className="h-24 w-full animate-pulse rounded-lg bg-nova-slab" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
