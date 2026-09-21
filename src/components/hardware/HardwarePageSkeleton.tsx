import GamesGridSkeleton from "@/src/components/games/GamesGridSkeleton";

/**
 * Full-page fallback for the <Suspense> wrapping HardwarePageBody,
 * mirrors GiftCardsPageSkeleton. GamesGridSkeleton is reused directly
 * rather than duplicated — its card-skeleton grid is not games-specific,
 * just an aspect-3/4 + title/tags/price placeholder that a hardware grid
 * looks identical to at this stage.
 */
export default function HardwarePageSkeleton() {
  return (
    <>
      {/* Reserves HardwareHero's own full-bleed aspect-[12/5] box, outside
          the padded wrapper below and in the same place as the real
          component, so Suspense resolving shifts nothing. */}
      <div className="aspect-[12/5] w-full animate-pulse bg-nova-slab" />

      <div className="mx-auto max-w-page px-4 py-16 md:px-8">
        <div className="mb-10 flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-11 w-24 animate-pulse rounded-full bg-nova-slab" />
          ))}
        </div>

        <GamesGridSkeleton />
      </div>
    </>
  );
}
