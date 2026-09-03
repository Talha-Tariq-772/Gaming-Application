"use client";

import { useEffect, useState } from "react";
import {
  createVariant,
  getVariantsForGame,
  reorderVariant,
  setVariantActive,
  setVariantMode,
  updateVariant,
  type AdminGameVariant,
  type VariantActionResult,
} from "@/src/lib/actions/admin-variants";
import { formatPrice } from "@/src/lib/format";
import { useFocusTrap } from "@/src/lib/use-focus-trap";
import { firstFieldErrors, variantFormSchema, type VariantFormErrors, type VariantFormInput } from "@/src/lib/validation";
import type { Game, VariantMode } from "@/src/types/database";

type FormValues = {
  label: string;
  pricePkr: string;
  wasPricePkr: string;
  priceSource: "catalog" | "estimate";
};

const BLANK_FORM: FormValues = { label: "", pricePkr: "", wasPricePkr: "", priceSource: "estimate" };

function toFormValues(variant: AdminGameVariant): FormValues {
  return {
    label: variant.label,
    pricePkr: String(variant.pricePkr),
    wasPricePkr: variant.wasPricePkr === null ? "" : String(variant.wasPricePkr),
    priceSource: variant.priceSource,
  };
}

export default function VariantsPanel({
  game,
  onClose,
  onVariantModeChanged,
}: {
  game: Game;
  onClose: () => void;
  onVariantModeChanged: (gameId: string, variantMode: VariantMode) => void;
}) {
  const panelRef = useFocusTrap<HTMLDivElement>(true, onClose);

  const [variants, setVariants] = useState<AdminGameVariant[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyVariantId, setBusyVariantId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [estimateOnly, setEstimateOnly] = useState(false);

  const [variantMode, setLocalVariantMode] = useState<VariantMode>(game.variantMode);
  const [variantModeSaving, setVariantModeSaving] = useState(false);
  const [variantModeError, setVariantModeError] = useState<string | null>(null);

  const [editingVariantId, setEditingVariantId] = useState<string | null>(null); // null = "add new" mode
  const [values, setValues] = useState<FormValues>(BLANK_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVariants(null);
    setLoadError(null);
    getVariantsForGame(game.id).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setVariants(result.variants);
    });
    return () => {
      cancelled = true;
    };
  }, [game.id]);

  function applyResult(result: VariantActionResult): boolean {
    if (!result.ok) {
      setRowError(result.message);
      return false;
    }
    setRowError(null);
    setVariants(result.variants);
    return true;
  }

  async function handleModeChange(mode: VariantMode) {
    if (mode === variantMode) return;
    setVariantModeSaving(true);
    setVariantModeError(null);
    const result = await setVariantMode(game.id, mode);
    setVariantModeSaving(false);
    if (!result.ok) {
      setVariantModeError(result.message);
      return;
    }
    setLocalVariantMode(result.variantMode);
    onVariantModeChanged(game.id, result.variantMode);
  }

  async function handleToggleActive(variant: AdminGameVariant) {
    setBusyVariantId(variant.id);
    const result = await setVariantActive(game.id, variant.id, !variant.isActive);
    setBusyVariantId(null);
    applyResult(result);
  }

  async function handleReorder(variant: AdminGameVariant, direction: "up" | "down") {
    setBusyVariantId(variant.id);
    const result = await reorderVariant(game.id, variant.id, direction);
    setBusyVariantId(null);
    applyResult(result);
  }

  function startEdit(variant: AdminGameVariant) {
    setEditingVariantId(variant.id);
    setValues(toFormValues(variant));
    setTouched({});
    setSubmitError(null);
  }

  function startAdd() {
    setEditingVariantId(null);
    setValues(BLANK_FORM);
    setTouched({});
    setSubmitError(null);
  }

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function blur(field: keyof FormValues) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  const parsed = variantFormSchema.safeParse(values satisfies VariantFormInput);
  const errors: VariantFormErrors = parsed.success ? {} : firstFieldErrors(parsed.error);

  function fieldError(field: keyof FormValues): string | undefined {
    return touched[field] ? errors[field] : undefined;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed.success) {
      setTouched({ label: true, pricePkr: true, wasPricePkr: true, priceSource: true });
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    const input = {
      label: parsed.data.label,
      pricePkr: parsed.data.pricePkr,
      wasPricePkr: parsed.data.wasPricePkr,
      priceSource: parsed.data.priceSource,
    };
    const result = editingVariantId
      ? await updateVariant(game.id, editingVariantId, input)
      : await createVariant(game.id, input);
    setIsSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.message);
      return;
    }
    setVariants(result.variants);
    setRowError(null);
    startAdd();
  }

  const visibleVariants = (variants ?? []).filter((v) => !estimateOnly || v.priceSource === "estimate");
  const estimateCount = (variants ?? []).filter((v) => v.priceSource === "estimate").length;

  return (
    <>
      <div onClick={onClose} aria-hidden="true" className="fixed inset-0 z-40 bg-nova-void/70" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="variants-panel-heading"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col overflow-y-auto border-l border-nova-hairline bg-nova-crypt"
      >
        <div className="flex items-start justify-between border-b border-nova-hairline px-5 py-4">
          <h2 id="variants-panel-heading" className="font-display text-lg font-bold text-nova-bone">
            {game.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center text-nova-ash hover:text-nova-bone"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-8 px-5 py-5">
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-nova-smoke">Variant Mode</h3>
            <div className="flex gap-2">
              {(["single", "multi"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={variantModeSaving}
                  onClick={() => handleModeChange(mode)}
                  aria-pressed={variantMode === mode}
                  className={`min-h-11 flex-1 rounded-md border px-3 py-2 text-sm font-semibold capitalize transition-colors duration-(--duration-fast) ease-standard disabled:cursor-not-allowed disabled:opacity-40 ${
                    variantMode === mode
                      ? "border-nova-ember bg-nova-ember-bright text-nova-void"
                      : "border-nova-hairline text-nova-ash hover:text-nova-bone"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-nova-smoke">
              {variantMode === "single"
                ? "Storefront shows a plain price, not a picker."
                : "Storefront shows a variant picker."}
            </p>
            {variantModeError && <p className="mt-2 text-xs text-nova-blood">{variantModeError}</p>}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-nova-smoke">Variants</h3>
              {estimateCount > 0 && (
                <span className="rounded-full bg-nova-gild/20 px-2 py-0.5 text-[11px] font-semibold text-nova-gild">
                  {estimateCount} estimated
                </span>
              )}
            </div>

            {estimateCount > 0 && (
              <label className="mb-3 flex items-center gap-2 text-xs text-nova-ash">
                <input
                  type="checkbox"
                  checked={estimateOnly}
                  onChange={(e) => setEstimateOnly(e.target.checked)}
                  className="h-4 w-4 accent-nova-ember"
                />
                Show only estimated prices
              </label>
            )}

            {rowError && <p className="mb-3 text-xs text-nova-blood">{rowError}</p>}

            {variants === null && !loadError && <p className="text-sm text-nova-ash">Loading variants…</p>}
            {loadError && <p className="text-sm text-nova-blood">{loadError}</p>}

            {variants !== null && visibleVariants.length === 0 && (
              <p className="text-sm text-nova-ash">
                {estimateOnly ? "No estimated-price variants." : "No variants yet."}
              </p>
            )}

            <ul className="flex flex-col gap-2">
              {visibleVariants.map((variant, index) => {
                const busy = busyVariantId === variant.id;
                // Buttons operate on the full (unfiltered) list's adjacency,
                // not the filtered view's — so disable them under the
                // estimate-only filter, where "up"/"down" here wouldn't
                // match what the button actually does against the real order.
                const disableReorder = estimateOnly;
                return (
                  <li
                    key={variant.id}
                    className={`rounded-md border border-nova-hairline p-3 ${variant.isActive ? "bg-nova-slab" : "bg-nova-void opacity-60"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-nova-bone">{variant.label}</p>
                        <p className="mt-0.5 text-xs text-nova-ash">
                          {formatPrice(variant.pricePkr)}
                          {variant.wasPricePkr !== null && (
                            <span className="ml-1.5 text-nova-smoke line-through">
                              {formatPrice(variant.wasPricePkr)}
                            </span>
                          )}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            variant.priceSource === "estimate"
                              ? "bg-nova-gild/20 text-nova-gild"
                              : "bg-nova-hairline/40 text-nova-smoke"
                          }`}
                        >
                          {variant.priceSource}
                        </span>
                        {!variant.isActive && (
                          <span className="ml-1.5 inline-block rounded-full bg-nova-hairline/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-nova-smoke">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={busy || disableReorder || index === 0}
                            onClick={() => handleReorder(variant, "up")}
                            aria-label={`Move ${variant.label} up`}
                            className="flex h-8 w-8 items-center justify-center rounded border border-nova-hairline text-nova-ash hover:text-nova-bone disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={busy || disableReorder || index === visibleVariants.length - 1}
                            onClick={() => handleReorder(variant, "down")}
                            aria-label={`Move ${variant.label} down`}
                            className="flex h-8 w-8 items-center justify-center rounded border border-nova-hairline text-nova-ash hover:text-nova-bone disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            ↓
                          </button>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => startEdit(variant)}
                            className="min-h-8 rounded border border-nova-hairline px-2 text-xs font-semibold text-nova-ember-text hover:text-nova-ember-lo disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleToggleActive(variant)}
                            className="min-h-8 rounded border border-nova-hairline px-2 text-xs font-semibold text-nova-ash hover:text-nova-bone disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busy ? "…" : variant.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-nova-smoke">
              {editingVariantId ? "Edit Variant" : "Add Variant"}
            </h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <input
                  type="text"
                  value={values.label}
                  onChange={(e) => update("label", e.target.value)}
                  onBlur={() => blur("label")}
                  placeholder="Label (e.g. Standard)"
                  aria-label="Label"
                  className="min-h-11 w-full rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
                />
                {fieldError("label") && <p className="mt-1 text-xs text-nova-blood">{fieldError("label")}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="number"
                    min={0}
                    value={values.pricePkr}
                    onChange={(e) => update("pricePkr", e.target.value)}
                    onBlur={() => blur("pricePkr")}
                    placeholder="Price (Rs)"
                    aria-label="Price (Rs)"
                    className="min-h-11 w-full rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
                  />
                  {fieldError("pricePkr") && (
                    <p className="mt-1 text-xs text-nova-blood">{fieldError("pricePkr")}</p>
                  )}
                </div>
                <div>
                  <input
                    type="number"
                    min={0}
                    value={values.wasPricePkr}
                    onChange={(e) => update("wasPricePkr", e.target.value)}
                    onBlur={() => blur("wasPricePkr")}
                    placeholder="Was-price (optional)"
                    aria-label="Was-price"
                    className="min-h-11 w-full rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
                  />
                  {fieldError("wasPricePkr") && (
                    <p className="mt-1 text-xs text-nova-blood">{fieldError("wasPricePkr")}</p>
                  )}
                </div>
              </div>

              <select
                value={values.priceSource}
                onChange={(e) => update("priceSource", e.target.value as "catalog" | "estimate")}
                aria-label="Price source"
                className="min-h-11 w-full rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 text-sm text-nova-bone focus:border-nova-ember focus:outline-none"
              >
                <option value="estimate">Estimate (unconfirmed)</option>
                <option value="catalog">Catalog (confirmed)</option>
              </select>

              {submitError && <p className="text-xs text-nova-blood">{submitError}</p>}

              <div className="flex gap-2">
                {editingVariantId && (
                  <button
                    type="button"
                    onClick={startAdd}
                    disabled={isSubmitting}
                    className="min-h-11 rounded-md border border-nova-hairline px-4 py-2 text-sm font-medium text-nova-ash hover:text-nova-bone disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-11 flex-1 rounded-md bg-nova-ember-bright px-4 py-2 text-sm font-semibold text-nova-void transition-colors duration-(--duration-fast) ease-standard hover:bg-nova-ember-bright-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSubmitting ? "Saving…" : editingVariantId ? "Save Changes" : "Add Variant"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
