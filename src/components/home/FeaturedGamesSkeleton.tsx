export default function FeaturedGamesSkeleton() {
  return (
    <section aria-hidden="true" className="overflow-hidden">
      <div className="mx-auto max-w-page px-4 py-24 md:px-8">
        <div className="mb-8 h-8 w-32 animate-pulse rounded bg-nova-slab" />
        <div className="flex gap-6 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex w-56 shrink-0 animate-pulse flex-col gap-3 sm:w-64">
              <div className="aspect-3/4 rounded-lg bg-nova-crypt" />
              {/* Matches GameCard's real text block below the cover: title
                  (up to 2 lines, line-clamp-2) + genre/platform tag row +
                  price line — the skeleton previously only reserved space
                  for one title line and nothing else, undersizing every
                  card by ~80px against the real rendered height. */}
              <div className="flex flex-col gap-1.5">
                <div className="h-8 w-4/5 rounded bg-nova-crypt" />
                <div className="h-6 w-2/3 rounded bg-nova-crypt" />
                <div className="mt-1 h-5 w-1/2 rounded bg-nova-crypt" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
