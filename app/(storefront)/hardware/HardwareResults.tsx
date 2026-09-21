import CursorFollowGrid from "@/src/components/motion/CursorFollowGrid";
import Reveal from "@/src/components/ui/nova/Reveal";
import HardwareCard from "@/src/components/hardware/HardwareCard";
import HardwareEmptyState from "@/src/components/hardware/HardwareEmptyState";
import { getHardwareProducts } from "@/src/lib/hardware-catalog";
import type { HardwareFilters } from "@/src/types/database";

/** Matches the first grid row at the widest breakpoint (xl:grid-cols-4) —
 * same reasoning as GiftCardsResults.tsx's ABOVE_FOLD_COUNT. */
const ABOVE_FOLD_COUNT = 4;

/**
 * Isolated in its own async Server Component so the Suspense boundary
 * wrapping it does not also cover the category bar — mirrors
 * GiftCardsResults.tsx.
 */
export default async function HardwareResults({ filters }: { filters: HardwareFilters }) {
  const products = await getHardwareProducts(filters);

  if (products.length === 0) {
    return <HardwareEmptyState resetHref="/hardware" filters={filters} />;
  }

  // In-stock first, then the catalog's own order. Sold-out rows stay
  // visible (a buyer may well want to know we carry it at all) but never
  // occupy the top of the grid, which is the one real ordering difference
  // from the digital listings.
  const ordered = [...products].sort((a, b) => {
    const aOut = a.stockQuantity <= 0 ? 1 : 0;
    const bOut = b.stockQuantity <= 0 ? 1 : 0;
    return aOut - bOut;
  });

  const aboveFold = ordered.slice(0, ABOVE_FOLD_COUNT);
  const rest = ordered.slice(ABOVE_FOLD_COUNT);

  return (
    <>
      <h2 className="sr-only">Results</h2>
      <CursorFollowGrid className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {aboveFold.map((product) => (
          <HardwareCard key={product.id} product={product} priority />
        ))}
        {rest.length > 0 && (
          <Reveal className="contents" batchByRow>
            {rest.map((product) => (
              <HardwareCard key={product.id} product={product} />
            ))}
          </Reveal>
        )}
      </CursorFollowGrid>
    </>
  );
}
