import { GUIDE_CATEGORY_LABELS } from "@/src/lib/guide-categories";
import { GUIDE_CATEGORIES } from "@/src/types/database";
import type { FaqItem } from "@/src/types/database";

/**
 * Pure server-rendered HTML. The name="faq" attribute makes every
 * <details> in this list a native exclusive-open group — the browser
 * closes any other open item when one is opened, no JS required. Each
 * <details> carries the FAQ item's id so a URL hash can target it
 * directly (see FaqHashSync for the deep-link open+scroll behavior).
 */
export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const grouped = GUIDE_CATEGORIES.map((category) => ({
    category,
    items: items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-12">
      {grouped.map(({ category, items: categoryItems }) => (
        <section key={category}>
          <h2 className="mb-4 font-display text-xl font-bold text-nova-bone">
            {GUIDE_CATEGORY_LABELS[category]}
          </h2>
          <div className="flex flex-col gap-3">
            {categoryItems.map((item) => (
              <details
                key={item.id}
                id={item.id}
                name="faq"
                className="group scroll-mt-24 rounded-lg border border-nova-hairline bg-nova-crypt"
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 p-4 text-sm font-semibold text-nova-bone">
                  {item.question}
                  <span
                    className="shrink-0 text-nova-ash transition-transform duration-(--duration-fast) ease-standard group-open:rotate-180"
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </summary>
                <p className="px-4 pb-4 text-sm text-nova-ash">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
