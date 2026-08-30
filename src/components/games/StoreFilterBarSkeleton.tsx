/**
 * Reserves StoreFilterBar's real footprint during the games route's
 * loading.tsx window. Its real height isn't a fixed number — it's a
 * `flex flex-wrap` row of variable-width chips that wraps to 1 row at
 * 1440px (measured: 69px) and 3 rows at 390px (measured: 181px) — so
 * rather than hard-code either number, this mirrors the real chip count
 * and approximate widths (same container classes, same min-h-11 chips) and
 * lets the browser wrap them the same way at whatever viewport actually
 * loads. "Clear all" is omitted — real StoreFilterBar only renders it once
 * a filter is active, never on first load.
 */
const CHIP_WIDTHS = ["w-28", "w-24", "w-20", "w-24", "w-16"];

export default function StoreFilterBarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mb-8 flex flex-wrap items-center gap-3 border-b border-nova-hairline pb-6"
    >
      {CHIP_WIDTHS.map((w) => (
        <div key={w} className={`h-11 ${w} animate-pulse rounded-full bg-nova-crypt`} />
      ))}
      <div className="ml-auto h-11 w-40 animate-pulse rounded-md bg-nova-crypt" />
    </div>
  );
}
