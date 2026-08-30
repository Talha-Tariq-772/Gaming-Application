export default function FeaturedGamesSkeleton() {
  return (
    <section aria-hidden="true" className="overflow-hidden">
      <div className="mx-auto max-w-page px-4 py-24 md:px-8">
        <div className="mb-8 h-8 w-32 animate-pulse rounded bg-nova-slab" />
        <div className="flex gap-6 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-56 shrink-0 animate-pulse sm:w-64">
              <div className="aspect-3/4 rounded-lg bg-nova-crypt" />
              <div className="mt-3 h-4 w-4/5 rounded bg-nova-crypt" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
