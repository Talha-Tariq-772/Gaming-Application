"use client";

import { useRef, useState } from "react";
import {
  removeGiftCardImage,
  uploadGiftCardImage,
  type GiftCardImageKind,
} from "@/src/lib/actions/admin-images";

/**
 * Upload / replace / remove one image on one gift-card product.
 *
 * Deliberately the same control shape as GameFormDialog's
 * ImageUploadField (preview thumb, Upload-or-Replace, Remove only when
 * something is stored, inline error under the buttons) rather than a new
 * pattern — the two screens sit next to each other in the same panel and
 * an admin should not have to learn image management twice.
 *
 * It talks to the server actions directly instead of routing through a
 * parent form: unlike a game, a gift card's art is not part of a wider
 * save, so there is no pending-form state for it to belong to. Each
 * action is its own committed change, which is also why every outcome
 * reports here rather than deferring to a form-level banner.
 */
export default function GiftCardImageField({
  productId,
  kind,
  label,
  hint,
  currentUrl,
  onChanged,
  onToast,
}: {
  productId: string;
  kind: GiftCardImageKind;
  label: string;
  hint: string;
  currentUrl: string | null;
  onChanged: (kind: GiftCardImageKind, url: string | null) => void;
  onToast: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Replacing writes to the SAME object path (upsert), so the public URL
  // never changes and the browser would keep showing the old bytes.
  const [cacheBust, setCacheBust] = useState(0);

  const inputId = `gc-image-${productId}-${kind}`;
  const previewSrc = currentUrl ? `${currentUrl}${cacheBust ? `?v=${cacheBust}` : ""}` : null;

  async function handleUpload(file: File) {
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("productId", productId);
      formData.set("kind", kind);
      formData.set("file", file);
      const result = await uploadGiftCardImage(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCacheBust(Date.now());
      onChanged(kind, result.url);
      onToast(`${label} updated`);
    } catch (e) {
      // A server action can reject outright (session expired mid-edit, a
      // network drop). Without this the promise rejects unhandled and the
      // button stays stuck on "Uploading…" with nothing shown.
      console.error("[GiftCardImageField] upload", e);
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemove() {
    setIsRemoving(true);
    setError(null);
    try {
      const result = await removeGiftCardImage(productId, kind);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCacheBust(0);
      onChanged(kind, null);
      onToast(`${label} removed`);
    } catch (e) {
      console.error("[GiftCardImageField] remove", e);
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsRemoving(false);
    }
  }

  const busy = isUploading || isRemoving;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1 block text-xs font-semibold uppercase tracking-wider text-nova-smoke"
      >
        {label}
      </label>
      <div className="flex items-start gap-3">
        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded border border-nova-hairline bg-nova-slab">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- storage object preview, same reasoning as GameFormDialog's ImageUploadField
            <img src={previewSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-nova-smoke">
              Using default
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // allow re-selecting the same file after an error
              if (file) handleUpload(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="min-h-11 w-fit rounded-md border border-nova-hairline px-3 py-2 text-xs font-semibold text-nova-ash hover:text-nova-bone disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUploading ? "Uploading…" : currentUrl ? "Replace" : "Upload"}
            </button>
            {currentUrl && (
              <button
                type="button"
                disabled={busy}
                onClick={handleRemove}
                className="min-h-11 w-fit rounded-md border border-nova-blood/40 px-3 py-2 text-xs font-semibold text-nova-blood hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isRemoving ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
          <p className="text-xs text-nova-smoke">{hint}</p>
          {error && (
            <p role="alert" className="text-xs text-nova-blood">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
