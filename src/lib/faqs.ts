import "server-only";

import { safeAsync } from "@/src/lib/safe-async";
import { createClient } from "@/src/lib/supabase/public";
import { GUIDE_CATEGORIES, type FaqItem, type GuideCategory } from "@/src/types/database";

/**
 * Real Supabase-backed FAQ reads, replacing mock-guides.ts's
 * MOCK_FAQ_ITEMS (supabase/migrations/20260920000001_faqs.sql).
 *
 * Uses the stateless anon client for the same reason catalog.ts does: the
 * /faq page has no per-user state, so this must not depend on cookies()
 * being available. RLS (faqs_select) already limits anon to published
 * rows — the explicit is_published filter below is belt-and-braces, and
 * keeps the intent readable at the call site.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFaqRow(row: any): FaqItem {
  return {
    id: row.id,
    slug: row.slug,
    question: row.question,
    answer: row.answer,
    category: row.category,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
  };
}

/** Category display/sort order — GUIDE_CATEGORIES is deliberately NOT
 * alphabetical (getting-started sorts first), so ordering goes through
 * this index rather than a plain column sort. An uncategorised entry
 * (category null) sorts after every named category. */
function categoryRank(category: GuideCategory | null): number {
  if (category === null) return GUIDE_CATEGORIES.length;
  const index = GUIDE_CATEGORIES.indexOf(category);
  return index === -1 ? GUIDE_CATEGORIES.length : index;
}

/** Published entries only, ordered by category then sort_order. */
export async function getFaqItems(): Promise<FaqItem[]> {
  return safeAsync("FAQ", async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("faqs")
      .select("*")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;

    // Postgres can't order by GUIDE_CATEGORIES' bespoke sequence without a
    // CASE expression PostgREST won't express, so the category ordering is
    // applied here; sort_order already arrives ascending from the query.
    return (data ?? []).map(mapFaqRow).sort((a, b) => {
      if (a.category !== b.category) return categoryRank(a.category) - categoryRank(b.category);
      return a.sortOrder - b.sortOrder;
    });
  });
}
