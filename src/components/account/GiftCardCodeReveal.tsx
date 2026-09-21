"use client";

import { useState } from "react";
import Button from "@/components/Button";
import CopyButton from "@/src/components/checkout/CopyButton";
import { useAuth } from "@/src/contexts/AuthContext";
import { track } from "@/src/lib/analytics";
import { revealGiftCardCode } from "@/src/lib/actions/credentials";
import { formatDateTime } from "@/src/lib/date";

/**
 * Gift-card counterpart to CredentialReveal — same security posture:
 * - The decrypted code lives only in this component's local state, never
 *   in a persisted Zustand store (those write to localStorage, which would
 *   leave a plaintext code on disk indefinitely). A refresh clears it and
 *   revealing again re-fetches; revealGiftCardCode is idempotent and won't
 *   overwrite the original revealed_at.
 * - Decryption happens server-side only and the code is never logged.
 *
 * Unlike a game credential there's no login/password pair to hide behind a
 * show/hide toggle — a gift card code is a single value the buyer needs to
 * read and paste, so it renders in full once revealed.
 */
export default function GiftCardCodeReveal({
  orderId,
  orderItemId,
  orderRef,
  productId,
  productTitle,
  redemptionInstructions,
}: {
  orderId: string;
  orderItemId: string;
  orderRef: string;
  productId: string;
  productTitle: string;
  redemptionInstructions: string | null;
}) {
  const { profile } = useAuth();
  const [revealing, setRevealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ code: string; revealedAt: string } | null>(null);

  async function handleReveal() {
    if (!profile) return;
    setRevealing(true);
    setError(null);
    try {
      const result = await revealGiftCardCode(orderId, orderItemId, profile.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setRevealed({ code: result.code, revealedAt: result.revealedAt });
      track("reveal_gift_card_code", { productId, orderRef });
    } catch (e) {
      // Same guarantee as CredentialReveal — see that file's comment for
      // why `setRevealing(false)` has to be in a finally rather than
      // after the await.
      console.error("[GiftCardCodeReveal]", e);
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setRevealing(false);
    }
  }

  return (
    <div className="rounded-lg border border-nova-hairline bg-nova-crypt p-6">
      <h3 className="font-display text-lg font-bold text-nova-bone">{productTitle}</h3>

      <span role="status" aria-live="polite" className="sr-only">
        {revealed ? `${productTitle} code revealed` : ""}
      </span>

      {!revealed ? (
        <div className="mt-4 flex flex-col items-start gap-4 rounded-md border border-nova-gild/30 bg-nova-gild/15 p-4">
          <p className="text-sm text-nova-gild">
            This code is shown once. Save it before closing this page.
          </p>
          {error && <p className="text-sm text-nova-blood">{error}</p>}
          <Button type="button" variant="primary" onClick={handleReveal} disabled={revealing}>
            {revealing ? "Revealing…" : "Reveal Code"}
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="rounded-md border border-nova-blood/30 bg-nova-blood/15 px-4 py-3 text-sm font-semibold text-nova-bone">
            Single-use. Once redeemed it can&rsquo;t be reused, refunded, or reissued — don&rsquo;t
            share it with anyone.
          </div>

          <div className="flex items-center justify-between gap-4 rounded-md border border-nova-hairline bg-nova-slab px-4 py-3">
            <div className="min-w-0">
              <span className="block text-xs text-nova-smoke">Code</span>
              <span className="block truncate font-mono text-sm tracking-wider text-nova-bone">
                {revealed.code}
              </span>
            </div>
            <CopyButton value={revealed.code} />
          </div>

          <p className="text-xs text-nova-smoke">Revealed on {formatDateTime(revealed.revealedAt)}</p>

          {redemptionInstructions && (
            <div className="mt-2 rounded-md border border-nova-hairline bg-nova-slab p-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-nova-smoke">
                How to redeem
              </h4>
              <p className="whitespace-pre-line text-sm text-nova-ash">{redemptionInstructions}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
