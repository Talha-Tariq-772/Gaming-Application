"use client";

import { useRef, useState } from "react";
import { useFocusTrap } from "@/src/lib/use-focus-trap";
import {
  firstFieldErrors,
  gameFormSchema,
  type GameFormErrors,
  type GameFormInput,
} from "@/src/lib/validation";
import { GAME_GENRES, GAME_PLATFORMS } from "@/src/types/database";
import type { Game, GameGenre, GamePlatform } from "@/src/types/database";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type FormValues = {
  title: string;
  slug: string;
  description: string;
  price: string;
  genre: GameGenre;
  platform: GamePlatform;
  coverImageUrl: string;
  trailerUrl: string;
  setupGuide: string;
  isActive: boolean;
};

type TextField = Exclude<keyof FormValues, "genre" | "platform" | "isActive">;

const TEXT_FIELDS: TextField[] = [
  "title",
  "slug",
  "description",
  "price",
  "coverImageUrl",
  "trailerUrl",
  "setupGuide",
];

function toFormValues(game: Game | null): FormValues {
  if (!game) {
    return {
      title: "",
      slug: "",
      description: "",
      price: "",
      genre: GAME_GENRES[0],
      platform: GAME_PLATFORMS[0],
      coverImageUrl: "",
      trailerUrl: "",
      setupGuide: "",
      isActive: true,
    };
  }
  return {
    title: game.title,
    slug: game.slug,
    description: game.description,
    price: String(game.price),
    genre: game.genre,
    platform: game.platform,
    coverImageUrl: game.coverImageUrl,
    trailerUrl: game.trailerUrl,
    setupGuide: game.setupGuide,
    isActive: game.isActive,
  };
}

export default function GameFormDialog({
  game,
  onCancel,
  onSave,
}: {
  /** null means "add new game" */
  game: Game | null;
  onCancel: () => void;
  onSave: (values: GameFormInput & { price: number }) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(game));
  const [slugTouched, setSlugTouched] = useState(Boolean(game));
  const [touched, setTouched] = useState<Partial<Record<TextField, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const panelRef = useFocusTrap<HTMLDivElement>(true, onCancel);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "title" && !slugTouched) {
        next.slug = slugify(String(value));
      }
      return next;
    });
  }

  function blur(field: TextField) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  // Full-form validation runs on every render (cheap, and every other
  // field's validity — e.g. "is the price still positive" — can change
  // as a side effect of any keystroke) — only the DISPLAY of a given
  // field's error is gated behind that field having been touched.
  const parsed = gameFormSchema.safeParse(values);
  const errors: GameFormErrors = parsed.success
    ? {}
    : firstFieldErrors(parsed.error);

  async function handleSave() {
    if (submittingRef.current) return;

    if (!parsed.success) {
      // Reveal every error at once rather than making the admin blur
      // through each field individually to discover what's wrong.
      setTouched(Object.fromEntries(TEXT_FIELDS.map((f) => [f, true])));
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    const result = await onSave({ ...parsed.data, price: Number(parsed.data.price) });
    if (!result.ok) {
      setSubmitError(result.message ?? "Something went wrong saving this game.");
      submittingRef.current = false;
      setIsSubmitting(false);
      return;
    }
    // No further reset on success — onSave closes this dialog (see the
    // parent's onCancel/setEditingGame(undefined) pattern), so there's
    // nothing left mounted to re-enable.
  }

  function fieldError(field: TextField): string | undefined {
    return touched[field] ? errors[field] : undefined;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div
        onClick={onCancel}
        aria-hidden="true"
        className="absolute inset-0 bg-bg/80"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={game ? "Edit game" : "Add game"}
        className="relative flex max-h-full w-full max-w-lg flex-col overflow-y-auto rounded-lg border border-border bg-surface-1 p-6"
      >
        <h2 className="text-lg font-bold text-text">
          {game ? "Edit Game" : "Add Game"}
        </h2>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label
              htmlFor="game-title"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-faint"
            >
              Title
            </label>
            <input
              id="game-title"
              type="text"
              value={values.title}
              onChange={(e) => update("title", e.target.value)}
              onBlur={() => blur("title")}
              aria-invalid={Boolean(fieldError("title"))}
              aria-describedby={fieldError("title") ? "game-title-error" : undefined}
              className="min-h-11 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
            />
            {fieldError("title") && (
              <p id="game-title-error" className="mt-1 text-xs text-danger">
                {fieldError("title")}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="game-slug"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-faint"
            >
              Slug
            </label>
            <input
              id="game-slug"
              type="text"
              value={values.slug}
              onChange={(e) => {
                setSlugTouched(true);
                update("slug", e.target.value);
              }}
              onBlur={() => blur("slug")}
              aria-invalid={Boolean(fieldError("slug"))}
              aria-describedby={fieldError("slug") ? "game-slug-error" : undefined}
              className="min-h-11 w-full rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text focus:border-accent focus:outline-none"
            />
            {fieldError("slug") && (
              <p id="game-slug-error" className="mt-1 text-xs text-danger">
                {fieldError("slug")}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="game-description"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-faint"
            >
              Description
            </label>
            <textarea
              id="game-description"
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
              onBlur={() => blur("description")}
              rows={3}
              aria-invalid={Boolean(fieldError("description"))}
              aria-describedby={
                fieldError("description") ? "game-description-error" : undefined
              }
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
            />
            {fieldError("description") && (
              <p id="game-description-error" className="mt-1 text-xs text-danger">
                {fieldError("description")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="game-price"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-faint"
              >
                Price (Rs)
              </label>
              <input
                id="game-price"
                type="number"
                min={0}
                value={values.price}
                onChange={(e) => update("price", e.target.value)}
                onBlur={() => blur("price")}
                aria-invalid={Boolean(fieldError("price"))}
                aria-describedby={fieldError("price") ? "game-price-error" : undefined}
                className="min-h-11 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
              />
              {fieldError("price") && (
                <p id="game-price-error" className="mt-1 text-xs text-danger">
                  {fieldError("price")}
                </p>
              )}
            </div>
            <div className="flex items-end">
              <label className="flex min-h-11 items-center gap-2 py-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={values.isActive}
                  onChange={(e) => update("isActive", e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                Active
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="game-genre"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-faint"
              >
                Genre
              </label>
              <select
                id="game-genre"
                value={values.genre}
                onChange={(e) => update("genre", e.target.value as GameGenre)}
                className="min-h-11 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
              >
                {GAME_GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="game-platform"
                className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-faint"
              >
                Platform
              </label>
              <select
                id="game-platform"
                value={values.platform}
                onChange={(e) => update("platform", e.target.value as GamePlatform)}
                className="min-h-11 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
              >
                {GAME_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="game-cover-url"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-faint"
            >
              Cover Image URL
            </label>
            <input
              id="game-cover-url"
              type="text"
              value={values.coverImageUrl}
              onChange={(e) => update("coverImageUrl", e.target.value)}
              onBlur={() => blur("coverImageUrl")}
              placeholder="https://…"
              aria-invalid={Boolean(fieldError("coverImageUrl"))}
              aria-describedby={
                fieldError("coverImageUrl") ? "game-cover-url-error" : undefined
              }
              className="min-h-11 w-full rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
            />
            {fieldError("coverImageUrl") && (
              <p id="game-cover-url-error" className="mt-1 text-xs text-danger">
                {fieldError("coverImageUrl")}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="game-trailer-url"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-faint"
            >
              Trailer URL
            </label>
            <input
              id="game-trailer-url"
              type="text"
              value={values.trailerUrl}
              onChange={(e) => update("trailerUrl", e.target.value)}
              onBlur={() => blur("trailerUrl")}
              placeholder="https://…"
              aria-invalid={Boolean(fieldError("trailerUrl"))}
              aria-describedby={
                fieldError("trailerUrl") ? "game-trailer-url-error" : undefined
              }
              className="min-h-11 w-full rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
            />
            {fieldError("trailerUrl") && (
              <p id="game-trailer-url-error" className="mt-1 text-xs text-danger">
                {fieldError("trailerUrl")}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="game-setup-guide"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-faint"
            >
              Setup Guide
            </label>
            <textarea
              id="game-setup-guide"
              value={values.setupGuide}
              onChange={(e) => update("setupGuide", e.target.value)}
              onBlur={() => blur("setupGuide")}
              rows={2}
              aria-invalid={Boolean(fieldError("setupGuide"))}
              aria-describedby={
                fieldError("setupGuide") ? "game-setup-guide-error" : undefined
              }
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
            />
            {fieldError("setupGuide") && (
              <p id="game-setup-guide-error" className="mt-1 text-xs text-danger">
                {fieldError("setupGuide")}
              </p>
            )}
          </div>
        </div>

        {submitError && <p className="mt-4 text-sm text-danger">{submitError}</p>}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="min-h-11 flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSave}
            className="min-h-11 flex-1 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Saving…" : game ? "Save Changes" : "Add Game"}
          </button>
        </div>
      </div>
    </div>
  );
}
