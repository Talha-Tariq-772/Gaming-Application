import GuideCard from "@/src/components/guides/GuideCard";
import SetupGuideCard from "@/src/components/guides/SetupGuideCard";
import NovaButton from "@/src/components/ui/nova/NovaButton";
import NovaCard from "@/src/components/ui/nova/NovaCard";
import Reveal from "@/src/components/ui/nova/Reveal";
import { GUIDE_CATEGORY_LABELS } from "@/src/lib/guide-categories";
import { getGuides } from "@/src/lib/mock-guides";
import { getSetupGuides } from "@/src/lib/setup-guides";
import { GUIDE_CATEGORIES } from "@/src/types/database";

/**
 * Isolated in its own async Server Component (rather than inlined in
 * page.tsx) so the Suspense boundary wrapping it doesn't also cover the
 * search input — the input stays interactive while only the results
 * re-suspend, same pattern as GamesResults.
 */
export default async function GuidesResults({ search }: { search?: string }) {
  const [setupGuides, guides] = await Promise.all([
    getSetupGuides({ search }),
    getGuides({ search }),
  ]);

  if (setupGuides.length === 0 && guides.length === 0) {
    return (
      <NovaCard className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="font-display text-xl font-bold text-nova-bone">
          No guides match your search
        </p>
        <p className="max-w-sm text-sm text-nova-ash">
          Try a different search term, or browse the FAQ instead.
        </p>
        <NovaButton as="a" href="/faq" variant="ghost">
          Browse FAQ
        </NovaButton>
      </NovaCard>
    );
  }

  const grouped = GUIDE_CATEGORIES.map((category) => ({
    category,
    guides: guides.filter((guide) => guide.category === category),
  })).filter((group) => group.guides.length > 0);

  return (
    <div className="flex flex-col gap-16">
      {setupGuides.length > 0 && (
        <section>
          <h2 className="mb-6 font-display text-xl font-bold text-nova-bone">
            Setup Guides
          </h2>
          <Reveal stagger={0.04} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {setupGuides.map((guide) => (
              <SetupGuideCard key={guide.id} guide={guide} />
            ))}
          </Reveal>
        </section>
      )}
      {grouped.map(({ category, guides: categoryGuides }) => (
        <section key={category}>
          <h2 className="mb-6 font-display text-xl font-bold text-nova-bone">
            {GUIDE_CATEGORY_LABELS[category]}
          </h2>
          <Reveal stagger={0.04} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categoryGuides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </Reveal>
        </section>
      ))}
    </div>
  );
}
