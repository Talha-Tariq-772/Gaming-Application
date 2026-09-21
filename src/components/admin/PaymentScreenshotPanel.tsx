"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPaymentScreenshotUrl } from "@/src/lib/actions/payment-screenshots";
import { formatDateTime } from "@/src/lib/date";

/**
 * The admin's view of a buyer's payment screenshot, reviewed INSIDE the
 * order panel, right above the Approve/Reject actions it informs.
 *
 * Inline, not a link: checking a screenshot against "Exact amount to
 * match" means looking at both at once, and a new tab puts them in two
 * different places. Clicking the image expands it in place to full panel
 * width instead of navigating away; "Open original" is still there for a
 * genuinely full-size look.
 *
 * The bucket is PRIVATE, so there is no public URL — this mints a
 * short-lived signed URL, admin-gated server-side. Those expire after 5
 * minutes, and an admin can easily leave a panel open longer than that,
 * so a load error re-signs ONCE and retries rather than leaving a broken
 * image. Once, not in a loop: a second failure means something is really
 * wrong, and says so.
 *
 * ABSENCE is reported loudly, because it's the state that blocks
 * approval (approve_order raises NO_PAYMENT_SCREENSHOT).
 */
export default function PaymentScreenshotPanel({
  orderId,
  onLoaded,
}: {
  orderId: string;
  /** Lets the parent disable Approve until evidence is confirmed present,
   * matching the database rule. */
  onLoaded?: (hasScreenshot: boolean) => void;
}) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "none"; message: string }
    | { kind: "error"; message: string }
    | { kind: "ready"; url: string; uploadedAt: string }
  >({ kind: "loading" });
  const [expanded, setExpanded] = useState(false);
  const resignedRef = useRef(false);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const load = useCallback(async () => {
    try {
      const result = await getPaymentScreenshotUrl(orderId);
      if (!result.ok) {
        setState({ kind: "none", message: result.message });
        onLoadedRef.current?.(false);
        return;
      }
      setState({ kind: "ready", url: result.url, uploadedAt: result.uploadedAt });
      onLoadedRef.current?.(true);
    } catch (e) {
      // A rejected server action (expired admin session, dropped
      // connection) must not leave a permanent skeleton.
      console.error("[PaymentScreenshotPanel]", e);
      setState({ kind: "error", message: "Couldn't load the payment screenshot. Close and reopen the order to retry." });
      onLoadedRef.current?.(false);
    }
  }, [orderId]);

  useEffect(() => {
    resignedRef.current = false;
    setExpanded(false);
    setState({ kind: "loading" });
    load();
  }, [load]);

  function handleImageError() {
    if (resignedRef.current) {
      setState({ kind: "error", message: "The screenshot couldn't be displayed. Close and reopen the order to retry." });
      return;
    }
    resignedRef.current = true;
    load();
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-nova-smoke">
        Payment proof
      </h3>

      {state.kind === "loading" && (
        <div className="h-48 w-full animate-pulse rounded-md bg-nova-slab" />
      )}

      {state.kind === "none" && (
        <div className="rounded-md border border-nova-gild/40 bg-nova-gild/10 p-3">
          <p className="text-sm font-semibold text-nova-gild">No screenshot uploaded yet</p>
          <p className="mt-1 text-xs text-nova-ash">
            This order can&rsquo;t be approved until the buyer uploads one.
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <p role="alert" className="rounded-md border border-nova-blood/40 bg-nova-blood/10 p-3 text-sm text-nova-blood">
          {state.message}
        </p>
      )}

      {state.kind === "ready" && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? "Shrink payment screenshot" : "Enlarge payment screenshot"}
            data-testid="payment-screenshot-toggle"
            className="block w-full cursor-zoom-in overflow-hidden rounded-md border border-nova-hairline bg-nova-slab text-left aria-expanded:cursor-zoom-out"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL from a private bucket; next/image would try to proxy/cache a URL that expires in minutes. */}
            <img
              src={state.url}
              alt="Payment screenshot supplied by the buyer"
              data-testid="payment-screenshot-img"
              onError={handleImageError}
              className={`w-full object-contain ${expanded ? "max-h-none" : "max-h-72"}`}
            />
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-nova-smoke">
            <span>
              Uploaded {formatDateTime(state.uploadedAt)} &middot;{" "}
              {expanded ? "click to shrink" : "click to enlarge"}
            </span>
            <a
              href={state.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-nova-ash hover:text-nova-bone"
            >
              Open original &rarr;
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
