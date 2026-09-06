import CursorFollowGrid from "@/src/components/motion/CursorFollowGrid";
import Reveal from "@/src/components/ui/nova/Reveal";
import GiftCardCard from "@/src/components/gift-cards/GiftCardCard";
import GiftCardEmptyState from "@/src/components/gift-cards/GiftCardEmptyState";
import { getGiftCardProducts } from "@/src/lib/gift-card-catalog";
import type { GiftCardFilters } from "@/src/types/database";

/** Matches the first grid row at the widest breakpoint (xl:grid-cols-4) —
 * same reasoning as GamesResults.tsx's ABOVE_FOLD_COUNT. */
const ABOVE_FOLD_COUNT = 4;

/**
 * Isolated in its own async Server Component so the Suspense boundary
 * wrapping it doesn't also cover the filter bar — mirrors GamesResults.tsx.
 */
export default async function GiftCardsResults({ filters }: { filters: GiftCardFilters }) {
  const products = await getGiftCardProducts(filters);

  if (products.length === 0) {
    return <GiftCardEmptyState resetHref="/gift-cards" filters={filters} />;
  }

  const aboveFold = products.slice(0, ABOVE_FOLD_COUNT);
  const rest = products.slice(ABOVE_FOLD_COUNT);

  return (
    <>
      <h2 className="sr-only">Results</h2>
      <CursorFollowGrid className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {aboveFold.map((product) => (
          <GiftCardCard key={product.id} product={product} priority />
        ))}
        {rest.length > 0 && (
          <Reveal className="contents" batchByRow>
            {rest.map((product) => (
              <GiftCardCard key={product.id} product={product} />
            ))}
          </Reveal>
        )}
      </CursorFollowGrid>
    </>
  );
}
