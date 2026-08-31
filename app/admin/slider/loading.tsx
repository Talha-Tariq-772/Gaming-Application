/**
 * Reserves /admin/slider's real footprint. Every value below is a
 * directly measured real height (390/768/1440px) via a real
 * headless-browser render against live data — not an estimate.
 *
 * - Heading block: 73px @390, 58px @768, 65px @1440 — the subtitle line
 *   wraps differently depending on how much width AdminNav's sidebar
 *   leaves at each breakpoint (sidebar only appears at md+).
 * - Slot list: constant 538px at every breakpoint measured (5 slots x
 *   98px + 4 x 12px gaps) — slot row height doesn't vary by viewport, so
 *   one set of placeholder rows covers all three.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex h-[73px] flex-col justify-center gap-2 md:h-[58px] lg:h-[65px]">
        <div className="h-6 w-40 animate-pulse rounded bg-nova-slab" />
        <div className="h-4 w-64 animate-pulse rounded bg-nova-slab" />
      </div>

      <ul className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="flex h-[98px] items-center gap-4 rounded-lg border border-nova-hairline bg-nova-crypt p-4"
          >
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-nova-slab" />
            <div className="h-16 w-28 shrink-0 animate-pulse rounded bg-nova-slab" />
            <div className="h-4 flex-1 animate-pulse rounded bg-nova-slab" />
          </li>
        ))}
      </ul>
    </div>
  );
}
