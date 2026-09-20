"use client";

import { useMemo, useState } from "react";
import AdminButton from "@/src/components/admin/AdminButton";
import DeleteFaqDialog from "@/src/components/admin/DeleteFaqDialog";
import FaqFormDialog from "@/src/components/admin/FaqFormDialog";
import { createFaq, deleteFaq, setFaqPublished, updateFaq } from "@/src/lib/actions/admin-faqs";
import { GUIDE_CATEGORY_LABELS } from "@/src/lib/guide-categories";
import { useToastStore } from "@/src/stores/toast-store";
import { GUIDE_CATEGORIES, type FaqItem, type GuideCategory } from "@/src/types/database";

/** Named categories in GUIDE_CATEGORIES' own (non-alphabetical) order,
 * then a trailing group for uncategorised entries — same ordering the
 * public page uses, so this screen reads in publication order. */
function groupFaqs(faqs: FaqItem[]): { key: string; label: string; items: FaqItem[] }[] {
  const groups = GUIDE_CATEGORIES.map((category: GuideCategory) => ({
    key: category as string,
    label: GUIDE_CATEGORY_LABELS[category],
    items: faqs.filter((f) => f.category === category).sort((a, b) => a.sortOrder - b.sortOrder),
  }));
  groups.push({
    key: "__none__",
    label: "Uncategorised",
    items: faqs.filter((f) => f.category === null).sort((a, b) => a.sortOrder - b.sortOrder),
  });
  return groups.filter((g) => g.items.length > 0);
}

export default function AdminFaqsClient({ initialFaqs }: { initialFaqs: FaqItem[] }) {
  const [faqs, setFaqs] = useState(initialFaqs);
  const [search, setSearch] = useState("");
  // undefined = closed, null = adding new, FaqItem = editing that entry.
  const [editingFaq, setEditingFaq] = useState<FaqItem | null | undefined>(undefined);
  const [deletingFaq, setDeletingFaq] = useState<FaqItem | null>(null);
  const showToast = useToastStore((s) => s.showToast);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.slug.toLowerCase().includes(q),
    );
  }, [faqs, search]);

  const grouped = useMemo(() => groupFaqs(filtered), [filtered]);
  const publishedCount = faqs.filter((f) => f.isPublished).length;

  async function handleSave(
    values: Parameters<typeof createFaq>[0],
  ): Promise<{ ok: boolean; message?: string }> {
    const result = editingFaq ? await updateFaq(editingFaq.id, values) : await createFaq(values);
    if (!result.ok) return result;

    setFaqs((prev) =>
      editingFaq
        ? prev.map((f) => (f.id === result.faq.id ? result.faq : f))
        : [...prev, result.faq],
    );
    showToast(editingFaq ? "FAQ updated" : "FAQ added");
    setEditingFaq(undefined);
    return { ok: true };
  }

  async function handleTogglePublished(faq: FaqItem) {
    const result = await setFaqPublished(faq.id, !faq.isPublished);
    if (!result.ok) {
      showToast(result.message);
      return;
    }
    setFaqs((prev) => prev.map((f) => (f.id === faq.id ? result.faq : f)));
  }

  async function handleConfirmDelete() {
    if (!deletingFaq) return;
    const result = await deleteFaq(deletingFaq.id);
    if (!result.ok) {
      showToast(result.message);
      setDeletingFaq(null);
      return;
    }
    setFaqs((prev) => prev.filter((f) => f.id !== deletingFaq.id));
    showToast("FAQ deleted");
    setDeletingFaq(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-nova-bone">FAQs</h1>
          <p className="mt-1 text-sm text-nova-ash">
            {faqs.length} total · {publishedCount} published
          </p>
        </div>
        <AdminButton variant="primary" onClick={() => setEditingFaq(null)}>
          Add FAQ
        </AdminButton>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search FAQs…"
        aria-label="Search FAQs"
        className="min-h-11 w-full max-w-xs rounded-md border border-nova-hairline bg-nova-crypt px-3 py-2 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
      />

      {grouped.length === 0 ? (
        <p className="rounded-lg border border-nova-hairline bg-nova-crypt p-6 text-sm text-nova-ash">
          {faqs.length === 0 ? "No FAQs yet — add the first one." : "No FAQs match that search."}
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map((group) => (
            <section key={group.key}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-nova-ash">
                {group.label}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.items.map((faq) => (
                  <li
                    key={faq.id}
                    className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-nova-hairline bg-nova-crypt p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-nova-bone">{faq.question}</span>
                        {!faq.isPublished && (
                          <span className="rounded-full border border-nova-gild/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-nova-gild">
                            Draft
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-nova-ash">{faq.answer}</p>
                      <p className="mt-1.5 font-mono text-xs text-nova-smoke">
                        #{faq.slug} · order {faq.sortOrder}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <AdminButton onClick={() => handleTogglePublished(faq)}>
                        {faq.isPublished ? "Unpublish" : "Publish"}
                      </AdminButton>
                      <AdminButton onClick={() => setEditingFaq(faq)}>Edit</AdminButton>
                      <AdminButton variant="destructive" onClick={() => setDeletingFaq(faq)}>
                        Delete
                      </AdminButton>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editingFaq !== undefined && (
        <FaqFormDialog
          faq={editingFaq}
          onCancel={() => setEditingFaq(undefined)}
          onSave={handleSave}
        />
      )}

      {deletingFaq && (
        <DeleteFaqDialog
          faq={deletingFaq}
          onCancel={() => setDeletingFaq(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
