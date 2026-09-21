import Link from "next/link";
import { HARDWARE_CATEGORIES, HARDWARE_CATEGORY_LABELS } from "@/src/types/database";
import type { HardwareCategory } from "@/src/types/database";

/**
 * Category filter for /hardware.
 *
 * Deliberately a row of plain <Link>s rather than a client component like
 * GiftCardFilterBar: hardware has exactly one filter dimension (category)
 * with six fixed values, so the whole control is expressible as six URLs.
 * That keeps it server-rendered, shareable, back-button-correct and free
 * of client JS. If a second dimension is ever added, this is the point to
 * reconsider and port GiftCardFilterBar's approach instead.
 */
export default function HardwareCategoryBar({
  active,
  inStockOnly,
}: {
  active: HardwareCategory | null;
  inStockOnly: boolean;
}) {
  function href(category: HardwareCategory | null): string {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (inStockOnly) params.set("stock", "in");
    const query = params.toString();
    return query ? `/hardware?${query}` : "/hardware";
  }

  function stockHref(): string {
    const params = new URLSearchParams();
    if (active) params.set("category", active);
    if (!inStockOnly) params.set("stock", "in");
    const query = params.toString();
    return query ? `/hardware?${query}` : "/hardware";
  }

  const pill =
    "inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] transition-colors duration-(--duration-fast) ease-standard";
  const on = "border-nova-ember bg-nova-ember-bright text-nova-void";
  const off = "border-nova-hairline text-nova-ash hover:text-nova-bone";

  return (
    <div className="mb-10 flex flex-wrap items-center gap-2">
      <Link href={href(null)} aria-current={active === null ? "page" : undefined} className={`${pill} ${active === null ? on : off}`}>
        All
      </Link>
      {HARDWARE_CATEGORIES.map((category) => (
        <Link
          key={category}
          href={href(category)}
          aria-current={active === category ? "page" : undefined}
          className={`${pill} ${active === category ? on : off}`}
        >
          {HARDWARE_CATEGORY_LABELS[category]}
        </Link>
      ))}

      <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-nova-hairline sm:block" />

      {/* A stock toggle earns its place here in a way it would not on the
          games or gift-card listings: those sell per-unit inventory that
          is either listed or not, while a hardware product stays listed
          at zero stock. */}
      <Link
        href={stockHref()}
        aria-pressed={inStockOnly}
        className={`${pill} ${inStockOnly ? on : off}`}
      >
        In stock only
      </Link>
    </div>
  );
}
