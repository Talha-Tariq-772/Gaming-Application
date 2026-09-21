"use client";

import { useRef, useState } from "react";
import AdminField, { ADMIN_INPUT_CLASS } from "@/src/components/admin/AdminField";
import AdminModal, { AdminDialogFooter } from "@/src/components/admin/AdminModal";
import {
  normaliseHardwareSlug,
  validateHardwareInput,
  type HardwareInput,
} from "@/src/lib/hardware-validation";
import {
  HARDWARE_CATEGORIES,
  HARDWARE_CATEGORY_LABELS,
  type AdminHardwareProduct,
  type HardwareCategory,
} from "@/src/types/database";

/**
 * Add/edit dialog for a hardware product.
 *
 * Two rules this form exists to honour, both learned from the dead Save
 * button on /admin/games (36cbb31):
 *
 *   1. Only fields that apply to EVERY hardware product are required —
 *      slug, name, category and sale price. Description, photos, cost
 *      price and sort order are all legitimately blank on a product
 *      someone is still writing up. The rules live in
 *      src/lib/hardware-validation.ts and are the same object the server
 *      action validates against, so the form cannot accept something the
 *      action rejects.
 *
 *   2. Pressing Save ALWAYS produces visible feedback. There is exactly
 *      one early return in handleSubmit (the concurrent-submit guard,
 *      which is only reachable while a submission is already in flight
 *      and the button is disabled), and every other path either sets
 *      `error` or hands off to the parent, which toasts. A validation
 *      failure renders its message in the footer banner whether or not
 *      the offending field has its own error slot — that last part is the
 *      specific gap that made the games form look broken, where a failure
 *      on a <select> had nowhere to render.
 */

interface FormValues {
  slug: string;
  name: string;
  description: string;
  category: HardwareCategory;
  /** Raw input strings — parsed on submit, so a half-typed "12." doesn't
   * fight the controlled input. */
  salePrice: string;
  /** "" means no cost recorded, which is NOT the same as 0. */
  costPrice: string;
  stockQuantity: string;
  /** One URL per line — a textarea, not a repeater, because pasting three
   * image paths is the actual task. */
  imageUrls: string;
  isActive: boolean;
  sortOrder: string;
}

function toFormValues(product: AdminHardwareProduct | null): FormValues {
  if (!product) {
    return {
      slug: "",
      name: "",
      description: "",
      category: HARDWARE_CATEGORIES[0],
      salePrice: "",
      costPrice: "",
      stockQuantity: "0",
      imageUrls: "",
      isActive: true,
      sortOrder: "",
    };
  }
  return {
    slug: product.slug,
    name: product.name,
    description: product.description,
    category: product.category,
    salePrice: String(product.salePrice),
    costPrice: product.costPrice === null ? "" : String(product.costPrice),
    stockQuantity: String(product.stockQuantity),
    imageUrls: product.imageUrls.join("\n"),
    isActive: product.isActive,
    sortOrder: product.sortOrder === null ? "" : String(product.sortOrder),
  };
}

/** Parses the form's raw strings into the shape the validator and action
 * both take. NaN is passed through deliberately — validateHardwareInput
 * rejects it with a readable message, which is better than this function
 * inventing a fallback number nobody typed. */
function toInput(values: FormValues): HardwareInput {
  return {
    slug: values.slug,
    name: values.name,
    description: values.description,
    category: values.category,
    salePrice: values.salePrice.trim() === "" ? NaN : Number(values.salePrice),
    costPrice: values.costPrice.trim() === "" ? null : Number(values.costPrice),
    stockQuantity: values.stockQuantity.trim() === "" ? 0 : Number(values.stockQuantity),
    imageUrls: values.imageUrls
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
    isActive: values.isActive,
    sortOrder: values.sortOrder.trim() === "" ? null : Number(values.sortOrder),
  };
}

export default function HardwareFormDialog({
  product,
  onCancel,
  onSave,
}: {
  /** null = adding a new product, AdminHardwareProduct = editing that one. */
  product: AdminHardwareProduct | null;
  onCancel: () => void;
  onSave: (values: HardwareInput) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(product));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Adding: the slug tracks the name until the admin edits it directly.
  // Editing: never auto-change it — the slug is the live product URL.
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const previewSlug = normaliseHardwareSlug(values.slug);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear a stale failure the moment the admin starts fixing it, rather
    // than leaving a message that no longer describes the form.
    if (error) setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // The ONLY early return without feedback, and only reachable while a
    // submit is already in flight (the button is disabled by then).
    if (submittingRef.current) return;

    const input = toInput(values);

    // Validated here with the same function the server action runs, so a
    // rejection is shown immediately instead of after a round-trip — and
    // so the two can never disagree about what is required.
    const invalid = validateHardwareInput(input);
    if (invalid) {
      setError(invalid);
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await onSave(input);
      if (!result.ok) {
        setError(result.message ?? "Something went wrong saving this product.");
        submittingRef.current = false;
        setIsSubmitting(false);
      }
      // On success the parent closes this dialog and toasts — leave the
      // footer disabled, there is nothing left mounted to re-enable.
    } catch (e) {
      // A server action can reject outright (session expired mid-edit, a
      // network drop). Without this the promise rejects unhandled, the
      // dialog stays spinning forever, and the admin sees nothing.
      console.error("[HardwareFormDialog]", e);
      setError("Couldn't reach the server. Check your connection and try again.");
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const labelClass = "text-xs font-semibold uppercase tracking-wider text-nova-smoke";

  return (
    <AdminModal
      onCancel={onCancel}
      ariaLabel={product ? "Edit hardware product" : "Add hardware product"}
      maxWidth="max-w-lg"
    >
      <h2 className="text-lg font-bold text-nova-bone">
        {product ? "Edit Hardware" : "Add Hardware"}
      </h2>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <AdminField label="Name" htmlFor="hw-name">
          <input
            id="hw-name"
            type="text"
            value={values.name}
            onChange={(e) => {
              update("name", e.target.value);
              if (!slugTouched) update("slug", e.target.value);
            }}
            placeholder="DualSense Wireless Controller"
            className={ADMIN_INPUT_CLASS}
          />
        </AdminField>

        <AdminField
          label="Slug"
          htmlFor="hw-slug"
          hint={previewSlug ? `/hardware/${previewSlug}` : "Used for the product page URL"}
        >
          <input
            id="hw-slug"
            type="text"
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              update("slug", e.target.value);
            }}
            className={ADMIN_INPUT_CLASS}
          />
        </AdminField>

        <AdminField label="Category" htmlFor="hw-category">
          <select
            id="hw-category"
            value={values.category}
            onChange={(e) => update("category", e.target.value as HardwareCategory)}
            className={ADMIN_INPUT_CLASS}
          >
            {HARDWARE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {HARDWARE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </AdminField>

        <AdminField
          label="Description"
          htmlFor="hw-description"
          hint="Optional — a product with no write-up yet still saves."
        >
          <textarea
            id="hw-description"
            rows={4}
            value={values.description}
            onChange={(e) => update("description", e.target.value)}
            className={`${ADMIN_INPUT_CLASS} min-h-24 resize-y`}
          />
        </AdminField>

        <div className="grid grid-cols-2 gap-4">
          <AdminField label="Sale price (Rs)" htmlFor="hw-sale-price">
            <input
              id="hw-sale-price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={values.salePrice}
              onChange={(e) => update("salePrice", e.target.value)}
              className={ADMIN_INPUT_CLASS}
            />
          </AdminField>

          <AdminField
            label="Cost price (Rs)"
            htmlFor="hw-cost-price"
            hint="Blank = not recorded"
          >
            <input
              id="hw-cost-price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={values.costPrice}
              onChange={(e) => update("costPrice", e.target.value)}
              className={ADMIN_INPUT_CLASS}
            />
          </AdminField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <AdminField
            label="Stock"
            htmlFor="hw-stock"
            hint="Units available to sell"
          >
            <input
              id="hw-stock"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={values.stockQuantity}
              onChange={(e) => update("stockQuantity", e.target.value)}
              className={ADMIN_INPUT_CLASS}
            />
          </AdminField>

          <AdminField label="Sort order" htmlFor="hw-sort" hint="Optional">
            <input
              id="hw-sort"
              type="number"
              step="1"
              inputMode="numeric"
              value={values.sortOrder}
              onChange={(e) => update("sortOrder", e.target.value)}
              className={ADMIN_INPUT_CLASS}
            />
          </AdminField>
        </div>

        <AdminField
          label="Image paths"
          htmlFor="hw-images"
          hint="One per line, e.g. /hardware/dualsense.png — optional. The first is used on cards."
        >
          <textarea
            id="hw-images"
            rows={3}
            value={values.imageUrls}
            onChange={(e) => update("imageUrls", e.target.value)}
            placeholder="/hardware/dualsense-front.png"
            className={`${ADMIN_INPUT_CLASS} min-h-20 resize-y font-mono text-xs`}
          />
        </AdminField>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => update("isActive", e.target.checked)}
            className="size-4 accent-nova-ember"
          />
          <span className={labelClass}>Active (visible in the store)</span>
        </label>

        {/* The catch-all feedback surface. Every failure path above ends
            here, including ones on fields with no error slot of their
            own — which is precisely the case that made the games form's
            Save button look dead. */}
        {error && (
          <p
            role="alert"
            data-testid="hardware-form-error"
            className="rounded-md border border-nova-blood/40 bg-nova-blood/10 px-3 py-2 text-sm text-nova-blood"
          >
            {error}
          </p>
        )}

        <AdminDialogFooter
          onCancel={onCancel}
          confirmType="submit"
          isSubmitting={isSubmitting}
          confirmVariant="primary"
          confirmLabel={product ? "Save Changes" : "Add Hardware"}
          confirmingLabel="Saving…"
        />
      </form>
    </AdminModal>
  );
}
