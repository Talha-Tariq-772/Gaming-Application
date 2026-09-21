"use client";

import { useEffect, useRef, useState } from "react";
import { formatDateTime } from "@/src/lib/date";
import {
  getScreenshotStatus,
  uploadPaymentScreenshot,
} from "@/src/lib/actions/payment-screenshots";

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Upload the payment screenshot, in-app. Replaces sending it over
 * WhatsApp.
 *
 * Used in all three places a buyer can be: the checkout confirmation
 * step, their own order page, and the no-login guest page. Those differ
 * only in whether a `lookupToken` is passed, so they share one widget
 * rather than three that drift apart.
 *
 * FEEDBACK CONTRACT — this is the third time this bug class has appeared
 * in this project (admin image upload, credential reveal), so it is
 * spelled out rather than left to care:
 *   - every await is inside try/catch/finally,
 *   - `setBusy(false)` lives in the finally, never after the await, so a
 *     REJECTED server action can't strand the button on "Uploading…",
 *   - every failure path sets a visible message; none return silently.
 * Next's 1 MB default Server Action body cap is what makes rejection a
 * real case and not a hypothetical — see next.config.ts.
 */
export default function PaymentScreenshotUpload({
  orderId,
  lookupToken,
  onUploaded,
}: {
  orderId: string;
  /** Present only for the no-login guest page — a guest has no session to
   * authorize with. */
  lookupToken?: string;
  onUploaded?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedAt, setUploadedAt] = useState<string | null>(null);
  const [canReplace, setCanReplace] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [dragging, setDragging] = useState(false);

  // Existing state, so returning to any of the three surfaces shows
  // "received" rather than prompting for an upload that already happened.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getScreenshotStatus(orderId, lookupToken ?? null);
        if (cancelled) return;
        setUploadedAt(status.uploadedAt);
        setCanReplace(status.canReplace);
      } catch (e) {
        // Non-fatal: failing to read the existing state must not block a
        // fresh upload, so this falls through to the prompt.
        console.error("[PaymentScreenshotUpload] status", e);
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, lookupToken]);

  async function handleFile(file: File) {
    // Checked here as well as server-side: a 9MB file rejected locally
    // saves the buyer a slow upload that was always going to fail.
    if (!file.type.startsWith("image/")) {
      setError("That isn't an image. Upload a PNG, JPEG or WebP screenshot.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Screenshot must be 10MB or smaller.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("orderId", orderId);
      if (lookupToken) formData.set("lookupToken", lookupToken);
      formData.set("file", file);

      const result = await uploadPaymentScreenshot(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setUploadedAt(result.uploadedAt);
      onUploaded?.();
    } catch (e) {
      console.error("[PaymentScreenshotUpload] upload", e);
      setError("Couldn't upload that screenshot. It may be too large, or the connection dropped.");
    } finally {
      setBusy(false);
    }
  }

  if (loadingStatus) {
    return <div className="h-32 w-full animate-pulse rounded-lg bg-nova-slab" />;
  }

  if (uploadedAt) {
    return (
      <div
        data-testid="screenshot-received"
        className="flex flex-col gap-3 rounded-lg border border-nova-ember/40 bg-nova-ember/10 p-4"
      >
        <p className="text-sm font-semibold text-nova-ember-text">
          Screenshot received &mdash; awaiting verification
        </p>
        <p className="text-xs text-nova-ash">Uploaded {formatDateTime(uploadedAt)}.</p>

        {canReplace ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) handleFile(file);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="min-h-11 w-fit rounded-md border border-nova-hairline px-3 py-2 text-xs font-semibold text-nova-ash hover:text-nova-bone disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Uploading…" : "Upload a different screenshot"}
            </button>
          </>
        ) : (
          <p className="text-xs text-nova-smoke">
            This order has been reviewed, so the screenshot can no longer be changed.
          </p>
        )}

        {error && (
          <p role="alert" className="text-xs text-nova-blood">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={`flex flex-col items-start gap-3 rounded-lg border border-dashed p-5 transition-colors duration-(--duration-fast) ${
          dragging ? "border-nova-ember bg-nova-ember/10" : "border-nova-hairline bg-nova-crypt"
        }`}
      >
        <p className="text-sm font-semibold text-nova-bone">Upload your payment screenshot</p>
        <p className="text-xs text-nova-ash">
          Drag it here, or choose a file. PNG, JPEG or WebP, up to 10MB. We use it to confirm your
          payment.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared so picking the SAME file again after an error still
            // fires a change event.
            e.target.value = "";
            if (file) handleFile(file);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          data-testid="screenshot-choose"
          className="min-h-11 rounded-md bg-nova-ember-bright px-4 py-2 text-sm font-semibold text-nova-void transition-colors hover:bg-nova-ember-bright-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Uploading…" : "Choose screenshot"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          data-testid="screenshot-error"
          className="rounded-md border border-nova-blood/40 bg-nova-blood/10 px-3 py-2 text-sm text-nova-blood"
        >
          {error}
        </p>
      )}
    </div>
  );
}
