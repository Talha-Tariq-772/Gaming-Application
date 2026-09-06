/** Mirrors src/components/games/StoreFilterBarSkeleton.tsx — reserves
 * GiftCardFilterBar's real footprint (two dropdown chips + sort, one row
 * of static known widths rather than a measured multi-row footprint since
 * this bar has far fewer chips than StoreFilterBar and never wraps at
 * normal viewport widths). */
export default function GiftCardFilterBarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mb-8 flex flex-wrap items-center gap-3 border-b border-nova-hairline pb-6"
    >
      <div className="h-11 w-28 animate-pulse rounded-full bg-nova-crypt" />
      <div className="h-11 w-24 animate-pulse rounded-full bg-nova-crypt" />
      <div className="ml-auto h-11 w-40 animate-pulse rounded-md bg-nova-crypt" />
    </div>
  );
}
