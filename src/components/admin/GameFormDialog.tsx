"use client";

import { useRef, useState } from "react";
import AdminField, { ADMIN_INPUT_CLASS } from "@/src/components/admin/AdminField";
import AdminModal, { AdminDialogFooter } from "@/src/components/admin/AdminModal";
import { removeGameImage, uploadGameImage } from "@/src/lib/actions/admin-images";
import { gameCoverImage, gameWallpaperImage } from "@/src/lib/storage-image";
import {
  firstFieldErrors,
  gameFormSchema,
  type GameFormErrors,
  type GameFormOutput,
} from "@/src/lib/validation";
import { GAME_GENRES, GAME_PLATFORM_LABELS, GAME_PLATFORMS } from "@/src/types/database";
import type { AdminGame, Game, GameGenre, GamePlatform, SetupGuide } from "@/src/types/database";

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
  /** "" means no cost recorded — not zero. */
  costPrice: string;
  /** "" = no genre, the correct state for a membership. */
  genre: GameGenre | "";
  /** Not editable here — carried so the schema knows whether genre is
   * required for this product (see gameFormSchema's superRefine). */
  productType: "game" | "membership";
  platform: GamePlatform;
  coverImageUrl: string;
  trailerUrl: string;
  setupGuide: string;
  isActive: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  /** Plain <input type="date"> value — "" means no date. */
  releaseDate: string;
  /** "" means no linked setup_guides row. */
  setupGuideId: string;
};

type TextField = Exclude<
  keyof FormValues,
  "genre" | "platform" | "productType" | "isActive" | "isNewArrival" | "isBestSeller" | "setupGuideId"
>;

const TEXT_FIELDS: TextField[] = [
  "title",
  "slug",
  "description",
  "price",
  "costPrice",
  "coverImageUrl",
  "trailerUrl",
  "setupGuide",
  "releaseDate",
];

function toFormValues(game: AdminGame | null): FormValues {
  if (!game) {
    return {
      title: "",
      slug: "",
      description: "",
      price: "",
      costPrice: "",
      genre: GAME_GENRES[0],
      productType: "game",
      platform: GAME_PLATFORMS[0],
      coverImageUrl: "",
      trailerUrl: "",
      setupGuide: "",
      isActive: true,
      isNewArrival: false,
      isBestSeller: false,
      releaseDate: "",
      setupGuideId: "",
    };
  }
  return {
    title: game.title,
    slug: game.slug,
    description: game.description,
    price: String(game.price),
    costPrice: game.costPrice === null || game.costPrice === undefined ? "" : String(game.costPrice),
    // NO fallback to GAME_GENRES[0] any more. That fallback is what
    // silently stamped "Action" onto PS Plus Extra & Premium: a controlled
    // <select value={null}> still displays the first option, so the form
    // looked valid while nobody had chosen anything. "" maps to the
    // explicit "— None —" option and stays null on save.
    genre: game.genre ?? "",
    productType: game.productType === "membership" ? "membership" : "game",
    // Every seeded game currently has platform = null (Session 1 populated
    // the column and its CHECK but never the values) — fall back to the
    // first option same as the "add new game" branch above, rather than
    // leaving the <select> on a value outside GAME_PLATFORMS. The dialog
    // shows a separate warning below the select when game.platform (the
    // real, un-defaulted value) is null, so this fallback doesn't hide
    // that it still needs to be set.
    platform: game.platform ?? GAME_PLATFORMS[0],
    coverImageUrl: game.coverImageUrl,
    trailerUrl: game.trailerUrl,
    setupGuide: game.setupGuide,
    isActive: game.isActive,
    isNewArrival: game.isNewArrival,
    isBestSeller: game.isBestSeller,
    releaseDate: game.releaseDate ?? "",
    setupGuideId: game.setupGuideId ?? "",
  };
}

/**
 * Cover/wallpaper preview + upload. Disabled in create mode (no gameId to
 * attach an upload to yet — uploadGameImage rejects that server-side too)
 * and, for covers specifically, on membership rows: cover_path is
 * documented null for every membership (20260829000002_games_catalog_columns.sql)
 * and uploadGameImage rejects that combination, so there's no point
 * offering a control that will always fail.
 */
function ImageUploadField({
  label,
  kind,
  disabled,
  disabledReason,
  previewSrc,
  isUploading,
  error,
  onFileSelected,
  onRemove,
  isRemoving = false,
}: {
  label: string;
  kind: "cover" | "wallpaper";
  disabled: boolean;
  disabledReason?: string;
  previewSrc: string | null;
  isUploading: boolean;
  error: string | null;
  onFileSelected: (file: File) => void;
  /** Absent when the caller has nothing removable to offer. */
  onRemove?: () => void;
  isRemoving?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `game-image-${kind}`;

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-nova-smoke">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded border border-nova-hairline bg-nova-slab">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- storage derivative preview, same reasoning as GameCard.tsx/storage-image.ts
            <img src={previewSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-center text-[10px] text-nova-smoke">
              No image
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={disabled || isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // allow re-selecting the same file after an error
              if (file) onFileSelected(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || isUploading || isRemoving}
              onClick={() => inputRef.current?.click()}
              className="min-h-11 w-fit rounded-md border border-nova-hairline px-3 py-2 text-xs font-semibold text-nova-ash hover:text-nova-bone disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUploading ? "Uploading…" : previewSrc ? "Replace" : "Upload"}
            </button>
            {/* Only rendered when something is actually stored — a Remove
                button next to "No image" would be a control that can
                only ever no-op. */}
            {onRemove && previewSrc && (
              <button
                type="button"
                disabled={disabled || isUploading || isRemoving}
                onClick={onRemove}
                className="min-h-11 w-fit rounded-md border border-nova-blood/40 px-3 py-2 text-xs font-semibold text-nova-blood hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isRemoving ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
          {disabled && disabledReason && <p className="text-xs text-nova-smoke">{disabledReason}</p>}
          {error && <p className="text-xs text-nova-blood">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export default function GameFormDialog({
  game,
  setupGuides,
  onCancel,
  onSave,
  onImageUpdated,
}: {
  /** null means "add new game" */
  game: AdminGame | null;
  /** Published guides only — same list customers can already reach. */
  setupGuides: SetupGuide[];
  onCancel: () => void;
  onSave: (
    values: GameFormOutput & { price: number; costPrice: number | null },
  ) => Promise<{ ok: boolean; message?: string }>;
  /** Fired after a successful image upload so the parent's game list (and
   * this dialog, if reopened) reflects the new cover_path/wallpaper_path
   * without a full reload. */
  onImageUpdated?: (gameId: string, patch: Partial<Pick<Game, "coverPath" | "wallpaperPath">>) => void;
}) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(game));
  const [slugTouched, setSlugTouched] = useState(Boolean(game));
  const [touched, setTouched] = useState<Partial<Record<TextField, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // genre is not a TEXT_FIELD, so it has no per-field "touched" entry —
  // this is what lets its error render after a save attempt.
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const submittingRef = useRef(false);

  const isMembership = game?.productType === "membership";

  const [coverPath, setCoverPath] = useState(game?.coverPath ?? null);
  const [wallpaperPath, setWallpaperPath] = useState(game?.wallpaperPath ?? null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [wallpaperUploading, setWallpaperUploading] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [wallpaperUploadError, setWallpaperUploadError] = useState<string | null>(null);
  const [coverRemoving, setCoverRemoving] = useState(false);
  const [wallpaperRemoving, setWallpaperRemoving] = useState(false);
  // Replacing an image uploads to the SAME object path (upsert:true), so
  // the URL alone never changes on a replace — this cache-busts just the
  // preview shown in this dialog for the rest of the session.
  const [cacheBust, setCacheBust] = useState(0);

  const coverImage = coverPath ? gameCoverImage(coverPath) : null;
  const wallpaperImage = wallpaperPath && game ? gameWallpaperImage(wallpaperPath, game.productType) : null;
  const coverPreviewSrc = coverImage ? `${coverImage.src}?v=${cacheBust}` : null;
  const wallpaperPreviewSrc = wallpaperImage ? `${wallpaperImage.src}?v=${cacheBust}` : null;

  async function handleImageUpload(kind: "cover" | "wallpaper", file: File) {
    if (!game) return;
    const setUploading = kind === "cover" ? setCoverUploading : setWallpaperUploading;
    const setError = kind === "cover" ? setCoverUploadError : setWallpaperUploadError;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("gameId", game.id);
      formData.set("kind", kind);
      formData.set("file", file);
      const result = await uploadGameImage(formData);

      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCacheBust(Date.now());
      if (kind === "cover") {
        setCoverPath(result.path);
        onImageUpdated?.(game.id, { coverPath: result.path });
      } else {
        setWallpaperPath(result.path);
        onImageUpdated?.(game.id, { wallpaperPath: result.path });
      }
    } catch (e) {
      // The action can REJECT rather than return ok:false, and this is not
      // hypothetical: Next refuses a Server Action body over its
      // bodySizeLimit with a bare 413 the action never sees, which is what
      // every real (2.8-3.4MB) source photo in this repo used to hit. With
      // the await unguarded, that rejection left `setUploading(false)`
      // unreached, so the button sat on "Uploading…" forever with nothing
      // displayed. next.config.ts raises the limit; this makes the failure
      // visible whatever causes it.
      console.error("[GameFormDialog] upload image", e);
      setError("Couldn't upload that image. It may be too large, or the connection dropped.");
    } finally {
      setUploading(false);
    }
  }

  /**
   * Clearing an image is a real, supported end state, not damage: the
   * storefront falls back to a placeholder cover and the shared header
   * art, both of which already render for every product that never had
   * an upload. Nulling the path here is what restores that fallback.
   */
  async function handleImageRemove(kind: "cover" | "wallpaper") {
    if (!game) return;
    const setRemoving = kind === "cover" ? setCoverRemoving : setWallpaperRemoving;
    const setError = kind === "cover" ? setCoverUploadError : setWallpaperUploadError;

    setRemoving(true);
    setError(null);
    try {
      const result = await removeGameImage(game.id, kind);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCacheBust(Date.now());
      if (kind === "cover") {
        setCoverPath(null);
        onImageUpdated?.(game.id, { coverPath: null });
      } else {
        setWallpaperPath(null);
        onImageUpdated?.(game.id, { wallpaperPath: null });
      }
    } catch (e) {
      // A server action can reject outright (session expired mid-edit,
      // a network drop). Without this the promise rejects unhandled and
      // the button stays stuck on "Removing…" with nothing shown.
      console.error("[GameFormDialog] remove image", e);
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setRemoving(false);
    }
  }

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

      // fieldError() only renders for TEXT_FIELDS, so a failure on
      // genre/platform/setupGuideId would otherwise show NOTHING and make
      // this button look dead. Surface those explicitly instead.
      setSubmitAttempted(true);
      const hidden = parsed.error.issues
        .map((issue) => String(issue.path[0]))
        .filter((field) => !TEXT_FIELDS.includes(field as TextField) && field !== "genre");
      setSubmitError(
        hidden.length
          ? `Fix these fields before saving: ${[...new Set(hidden)].join(", ")}.`
          : null,
      );
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    const result = await onSave({
      ...parsed.data,
      price: Number(parsed.data.price),
      costPrice: parsed.data.costPrice,
    });
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
    <AdminModal onCancel={onCancel} ariaLabel={game ? "Edit game" : "Add game"} maxWidth="max-w-lg">
      <h2 className="text-lg font-bold text-nova-bone">
        {game ? "Edit Game" : "Add Game"}
      </h2>

      <div className="mt-4 flex flex-col gap-4">
        <AdminField label="Title" htmlFor="game-title" error={fieldError("title")}>
          <input
            id="game-title"
            type="text"
            value={values.title}
            onChange={(e) => update("title", e.target.value)}
            onBlur={() => blur("title")}
            aria-invalid={Boolean(fieldError("title"))}
            aria-describedby={fieldError("title") ? "game-title-error" : undefined}
            className={ADMIN_INPUT_CLASS}
          />
        </AdminField>

        <AdminField label="Slug" htmlFor="game-slug" error={fieldError("slug")}>
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
            className={`${ADMIN_INPUT_CLASS} font-mono`}
          />
        </AdminField>

        <AdminField label="Description" htmlFor="game-description" error={fieldError("description")}>
          <textarea
            id="game-description"
            value={values.description}
            onChange={(e) => update("description", e.target.value)}
            onBlur={() => blur("description")}
            rows={3}
            aria-invalid={Boolean(fieldError("description"))}
            aria-describedby={fieldError("description") ? "game-description-error" : undefined}
            className={ADMIN_INPUT_CLASS}
          />
        </AdminField>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <AdminField label="Price (Rs)" htmlFor="game-price" error={fieldError("price")}>
            <input
              id="game-price"
              type="number"
              min={0}
              value={values.price}
              onChange={(e) => update("price", e.target.value)}
              onBlur={() => blur("price")}
              aria-invalid={Boolean(fieldError("price"))}
              aria-describedby={fieldError("price") ? "game-price-error" : undefined}
              className={ADMIN_INPUT_CLASS}
            />
          </AdminField>

          {/* Admin-only. cost_price is revoked from anon/authenticated at
              the column level (20260920000002_cost_price.sql), so this
              value never reaches a public response or page. Saving it also
              records a cost_price_history row — see setGameCostPrice. */}
          <AdminField label="Cost (Rs)" htmlFor="game-cost-price" error={fieldError("costPrice")}>
            <input
              id="game-cost-price"
              type="number"
              min={0}
              step="0.01"
              placeholder="Not set"
              value={values.costPrice}
              onChange={(e) => update("costPrice", e.target.value)}
              onBlur={() => blur("costPrice")}
              aria-invalid={Boolean(fieldError("costPrice"))}
              aria-describedby={fieldError("costPrice") ? "game-cost-price-error" : "game-cost-price-help"}
              className={ADMIN_INPUT_CLASS}
            />
            <p id="game-cost-price-help" className="mt-1 text-xs text-nova-smoke">
              Internal only — never shown publicly. Blank means no cost on record.
            </p>
          </AdminField>

          <div className="flex items-end">
            <label className="flex min-h-11 items-center gap-2 py-2 text-sm text-nova-ash">
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(e) => update("isActive", e.target.checked)}
                className="h-4 w-4 accent-nova-ember"
              />
              Active
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Prominent by design: platform is null on every seeded game
              (Session 1 added the column but never the values), and
              populating it is what lets setup guides be split by
              platform. Placed before Genre for visibility, plus the
              explicit warning below when the underlying value is
              really still null. */}
          <AdminField
            label="Platform"
            htmlFor="game-platform"
            hint={game && game.platform === null ? "Not set yet — pick one and save." : undefined}
          >
            <select
              id="game-platform"
              value={values.platform}
              onChange={(e) => update("platform", e.target.value as GamePlatform)}
              className={ADMIN_INPUT_CLASS}
            >
              {GAME_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {GAME_PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
          </AdminField>
          {/* Genre is required for a game and meaningless for a
              membership — the same split the database enforces
              (games_genre_required_for_game_check). The explicit
              "— None —" option is what makes "no genre" a thing an admin
              can actually see and choose, instead of the old invisible
              null that the select rendered as "Action". */}
          <AdminField
            label={isMembership ? "Genre (not used for memberships)" : "Genre"}
            htmlFor="game-genre"
            error={submitAttempted ? errors.genre : undefined}
          >
            <select
              id="game-genre"
              value={values.genre}
              onChange={(e) => update("genre", e.target.value as GameGenre | "")}
              aria-invalid={Boolean(submitAttempted && errors.genre)}
              className={ADMIN_INPUT_CLASS}
            >
              <option value="">— None —</option>
              {GAME_GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </AdminField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ImageUploadField
            label="Cover Image"
            kind="cover"
            disabled={!game || isMembership}
            disabledReason={
              !game
                ? "Save the game first to upload a cover."
                : isMembership
                  ? "Memberships don't have cover art."
                  : undefined
            }
            previewSrc={coverPreviewSrc}
            isUploading={coverUploading}
            error={coverUploadError}
            onFileSelected={(file) => handleImageUpload("cover", file)}
            onRemove={() => handleImageRemove("cover")}
            isRemoving={coverRemoving}
          />
          <ImageUploadField
            label={isMembership ? "Header Image" : "Wallpaper"}
            kind="wallpaper"
            disabled={!game}
            disabledReason={!game ? "Save the game first to upload a wallpaper." : undefined}
            previewSrc={wallpaperPreviewSrc}
            isUploading={wallpaperUploading}
            error={wallpaperUploadError}
            onFileSelected={(file) => handleImageUpload("wallpaper", file)}
            onRemove={() => handleImageRemove("wallpaper")}
            isRemoving={wallpaperRemoving}
          />
        </div>

        <AdminField label="Cover Image URL (optional)" htmlFor="game-cover-url" error={fieldError("coverImageUrl")}>
          <input
            id="game-cover-url"
            type="text"
            value={values.coverImageUrl}
            onChange={(e) => update("coverImageUrl", e.target.value)}
            onBlur={() => blur("coverImageUrl")}
            placeholder="https://…"
            aria-invalid={Boolean(fieldError("coverImageUrl"))}
            aria-describedby={fieldError("coverImageUrl") ? "game-cover-url-error" : undefined}
            className={`${ADMIN_INPUT_CLASS} font-mono text-xs`}
          />
        </AdminField>

        <AdminField label="Trailer URL (optional)" htmlFor="game-trailer-url" error={fieldError("trailerUrl")}>
          <input
            id="game-trailer-url"
            type="text"
            value={values.trailerUrl}
            onChange={(e) => update("trailerUrl", e.target.value)}
            onBlur={() => blur("trailerUrl")}
            placeholder="https://…"
            aria-invalid={Boolean(fieldError("trailerUrl"))}
            aria-describedby={fieldError("trailerUrl") ? "game-trailer-url-error" : undefined}
            className={`${ADMIN_INPUT_CLASS} font-mono text-xs`}
          />
        </AdminField>

        <AdminField label="Setup Guide (Free Text)" htmlFor="game-setup-guide" error={fieldError("setupGuide")}>
          <textarea
            id="game-setup-guide"
            value={values.setupGuide}
            onChange={(e) => update("setupGuide", e.target.value)}
            onBlur={() => blur("setupGuide")}
            rows={2}
            aria-invalid={Boolean(fieldError("setupGuide"))}
            aria-describedby={fieldError("setupGuide") ? "game-setup-guide-error" : undefined}
            className={ADMIN_INPUT_CLASS}
          />
        </AdminField>

        <AdminField label="Linked Setup Guide" htmlFor="game-setup-guide-id">
          <select
            id="game-setup-guide-id"
            value={values.setupGuideId}
            onChange={(e) => update("setupGuideId", e.target.value)}
            className={ADMIN_INPUT_CLASS}
          >
            <option value="">None</option>
            {setupGuides.map((sg) => (
              <option key={sg.id} value={sg.id}>
                {sg.title}
                {sg.platform ? ` (${GAME_PLATFORM_LABELS[sg.platform]})` : ""}
              </option>
            ))}
          </select>
        </AdminField>

        <div className="grid grid-cols-2 gap-4">
          <AdminField label="Release Date" htmlFor="game-release-date" error={fieldError("releaseDate")}>
            <input
              id="game-release-date"
              type="date"
              value={values.releaseDate}
              onChange={(e) => update("releaseDate", e.target.value)}
              onBlur={() => blur("releaseDate")}
              aria-invalid={Boolean(fieldError("releaseDate"))}
              aria-describedby={fieldError("releaseDate") ? "game-release-date-error" : undefined}
              className={ADMIN_INPUT_CLASS}
            />
          </AdminField>
          <div className="flex flex-col justify-end gap-1">
            <label className="flex min-h-11 items-center gap-2 py-2 text-sm text-nova-ash">
              <input
                type="checkbox"
                checked={values.isNewArrival}
                onChange={(e) => update("isNewArrival", e.target.checked)}
                className="h-4 w-4 accent-nova-ember"
              />
              New Arrival
            </label>
            <label className="flex min-h-11 items-center gap-2 py-2 text-sm text-nova-ash">
              <input
                type="checkbox"
                checked={values.isBestSeller}
                onChange={(e) => update("isBestSeller", e.target.checked)}
                className="h-4 w-4 accent-nova-ember"
              />
              Best Seller
            </label>
          </div>
        </div>
      </div>

      {submitError && <p className="mt-4 text-sm text-nova-blood">{submitError}</p>}

      <AdminDialogFooter
        onCancel={onCancel}
        onConfirm={handleSave}
        isSubmitting={isSubmitting}
        confirmVariant="primary"
        confirmLabel={game ? "Save Changes" : "Add Game"}
        confirmingLabel="Saving…"
      />
    </AdminModal>
  );
}
