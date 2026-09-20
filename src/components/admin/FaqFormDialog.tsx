"use client";

import { useRef, useState } from "react";
import AdminModal, { AdminDialogFooter } from "@/src/components/admin/AdminModal";
import { GUIDE_CATEGORY_LABELS } from "@/src/lib/guide-categories";
import { GUIDE_CATEGORIES, type FaqItem, type GuideCategory } from "@/src/types/database";
import type { FaqInput } from "@/src/lib/actions/admin-faqs";

const UNCATEGORISED = "__none__";

/** Mirrors normaliseSlug in admin-faqs.ts — previewed here so an admin
 * sees the anchor they will actually get; the server re-derives it. */
function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function FaqFormDialog({
  faq,
  onCancel,
  onSave,
}: {
  /** null = adding a new entry, FaqItem = editing that entry. */
  faq: FaqItem | null;
  onCancel: () => void;
  onSave: (values: FaqInput) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [slug, setSlug] = useState(faq?.slug ?? "");
  const [question, setQuestion] = useState(faq?.question ?? "");
  const [answer, setAnswer] = useState(faq?.answer ?? "");
  const [category, setCategory] = useState<string>(faq?.category ?? UNCATEGORISED);
  const [sortOrder, setSortOrder] = useState(String(faq?.sortOrder ?? 0));
  const [isPublished, setIsPublished] = useState(faq?.isPublished ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Adding: the slug tracks the question until the admin edits it
  // directly, so the common case needs no thought. Editing: never
  // auto-change it — the slug is a live anchor other pages link to.
  const [slugTouched, setSlugTouched] = useState(Boolean(faq));
  const previewSlug = slugify(slug);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    const parsedOrder = Number(sortOrder);
    const result = await onSave({
      slug,
      question,
      answer,
      category: category === UNCATEGORISED ? null : (category as GuideCategory),
      sortOrder: Number.isFinite(parsedOrder) ? Math.trunc(parsedOrder) : NaN,
      isPublished,
    });

    if (!result.ok) {
      setError(result.message ?? "Something went wrong.");
      submittingRef.current = false;
      setIsSubmitting(false);
    }
    // On success the parent closes this dialog — leave it disabled.
  }

  const fieldClass =
    "min-h-11 w-full rounded-md border border-nova-hairline bg-nova-void px-3 py-2 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none";
  const labelClass = "text-xs font-semibold uppercase tracking-wider text-nova-ash";

  return (
    <AdminModal onCancel={onCancel} ariaLabel={faq ? "Edit FAQ" : "Add FAQ"} maxWidth="max-w-lg">
      <h2 className="text-lg font-bold text-nova-bone">{faq ? "Edit FAQ" : "Add FAQ"}</h2>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="faq-question" className={labelClass}>
            Question
          </label>
          <input
            id="faq-question"
            type="text"
            required
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              if (!slugTouched) setSlug(e.target.value);
            }}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="faq-answer" className={labelClass}>
            Answer
          </label>
          <textarea
            id="faq-answer"
            required
            rows={6}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className={`${fieldClass} min-h-32 resize-y`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="faq-slug" className={labelClass}>
            Slug
          </label>
          <input
            id="faq-slug"
            type="text"
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            aria-describedby="faq-slug-help"
            className={fieldClass}
          />
          <p id="faq-slug-help" className="text-xs text-nova-smoke">
            Anchor for this answer:{" "}
            <span className="text-nova-ash">/faq#{previewSlug || "…"}</span>
            {faq ? " — changing it breaks existing links to this answer." : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex min-w-40 flex-1 flex-col gap-1.5">
            <label htmlFor="faq-category" className={labelClass}>
              Category
            </label>
            <select
              id="faq-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={fieldClass}
            >
              <option value={UNCATEGORISED}>Uncategorised</option>
              {GUIDE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {GUIDE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex w-28 flex-col gap-1.5">
            <label htmlFor="faq-order" className={labelClass}>
              Order
            </label>
            <input
              id="faq-order"
              type="number"
              min={0}
              max={32767}
              step={1}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        <label className="flex min-h-11 items-center gap-2 text-sm text-nova-ash">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="size-4 accent-nova-ember"
          />
          Published (visible on the public FAQ page)
        </label>

        {error && (
          <p role="alert" className="text-sm text-nova-blood">
            {error}
          </p>
        )}

        <AdminDialogFooter
          onCancel={onCancel}
          confirmType="submit"
          confirmLabel={faq ? "Save Changes" : "Add FAQ"}
          confirmingLabel="Saving…"
          isSubmitting={isSubmitting}
        />
      </form>
    </AdminModal>
  );
}
