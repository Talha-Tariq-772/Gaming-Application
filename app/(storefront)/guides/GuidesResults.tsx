import Button from "@/components/Button";
import GuideCard from "@/src/components/guides/GuideCard";
import { GUIDE_CATEGORY_LABELS } from "@/src/lib/guide-categories";
import { getGuides } from "@/src/lib/mock-guides";
import { GUIDE_CATEGORIES } from "@/src/types/database";

/**
 * Isolated in its own async Server Component (rather than inlined in
 * page.tsx) so the Suspense boundary wrapping it doesn't also cover the
 * search input — the input stays interactive while only the results
 * re-suspend, same pattern as GamesResults.
 */
export default async function GuidesResults({ search }: { search?: string }) {
  const guides = await getGuides({ search });

  if (guides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface-1 px-6 py-24 text-center">
        <p className="font-display text-xl font-bold text-text">
          No guides match your search
        </p>
        <p className="max-w-sm text-sm text-text-muted">
          Try a different search term, or browse the FAQ instead.
        </p>
        <Button as="a" href="/faq" variant="secondary">
          Browse FAQ
        </Button>
      </div>
    );
  }

  const grouped = GUIDE_CATEGORIES.map((category) => ({
    category,
    guides: guides.filter((guide) => guide.category === category),
  })).filter((group) => group.guides.length > 0);

  return (
    <div className="flex flex-col gap-16">
      {grouped.map(({ category, guides: categoryGuides }) => (
        <section key={category}>
          <h2 className="mb-6 font-display text-xl font-bold text-text">
            {GUIDE_CATEGORY_LABELS[category]}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categoryGuides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
