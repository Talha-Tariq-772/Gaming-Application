"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import { track } from "@/src/lib/analytics";
import { formatPrice } from "@/src/lib/format";
import { useOnlineStatus } from "@/src/lib/use-online-status";
import { useCheckoutStore } from "@/src/stores/checkout-store";
import type { Order, PaymentMethod } from "@/src/types/database";
import CopyButton from "./CopyButton";
import CountdownTimer from "./CountdownTimer";

export default function StepPaymentInstructions({
  order,
  paymentMethods,
}: {
  order: Order;
  paymentMethods: PaymentMethod[];
}) {
  const markPaid = useCheckoutStore((s) => s.markPaid);
  const markOrderExpired = useCheckoutStore((s) => s.markOrderExpired);
  const resetCheckout = useCheckoutStore((s) => s.resetCheckout);
  const isOnline = useOnlineStatus();
  const [expired, setExpired] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const method = paymentMethods.find((m) => m.id === order.paymentMethodId);

  const viewInstructionsFired = useRef(false);
  useEffect(() => {
    if (!viewInstructionsFired.current && method && !expired) {
      viewInstructionsFired.current = true;
      track("view_payment_instructions", {
        orderRef: order.paymentReference,
        method: method.label,
      });
    }
  }, [method, expired, order.paymentReference]);

  if (!method) return null;

  if (expired) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-nova-hairline bg-nova-crypt px-6 py-24 text-center">
        <h2 className="font-display text-xl font-bold text-nova-bone">
          Reservation expired
        </h2>
        <p className="max-w-sm text-sm text-nova-ash">
          Your 45-minute payment window has closed. Start over to get a new
          reference and reservation.
        </p>
        <Button type="button" variant="secondary" onClick={resetCheckout}>
          Start Over
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-nova-ember bg-nova-crypt p-6 shadow-glow">
          <span className="text-xs font-semibold uppercase tracking-wider text-nova-smoke">
            Amount to transfer
          </span>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {/* Session 9: no font-extrabold — text-4xl isn't covered by
                the .font-display compound rules (globals.css), so this
                was requesting a weight Marcellus doesn't ship. */}
            <span className="text-4xl font-display text-nova-bone">
              {formatPrice(order.amountExact)}
            </span>
            <CopyButton
              value={String(order.amountExact)}
              label="Copy amount"
            />
          </div>
          <p className="mt-3 text-sm text-nova-ash">
            Transfer this exact amount — the extra paisa is how we match
            your payment automatically.
          </p>
        </div>

        <div className="rounded-lg border border-nova-hairline bg-nova-crypt p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-nova-smoke">
            {method.label} details
          </h2>
          <dl className="flex flex-col gap-4">
            <div>
              <dt className="text-xs text-nova-smoke">Account Title</dt>
              <dd className="text-sm text-nova-bone">{method.accountTitle}</dd>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <dt className="text-xs text-nova-smoke">Account Number</dt>
                <dd className="font-mono text-sm text-nova-bone">
                  {method.accountNumber}
                </dd>
              </div>
              <CopyButton value={method.accountNumber} />
            </div>

            {method.iban && (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <dt className="text-xs text-nova-smoke">IBAN</dt>
                  <dd className="font-mono text-sm text-nova-bone">
                    {method.iban}
                  </dd>
                </div>
                <CopyButton value={method.iban} />
              </div>
            )}

            {method.raastId && (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <dt className="text-xs text-nova-smoke">RAAST ID</dt>
                  <dd className="font-mono text-sm text-nova-bone">
                    {method.raastId}
                  </dd>
                </div>
                <CopyButton value={method.raastId} />
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div>
                <dt className="text-xs text-nova-smoke">Reference</dt>
                <dd className="font-mono text-sm text-nova-bone">
                  {order.paymentReference}
                </dd>
              </div>
              <CopyButton value={order.paymentReference} />
            </div>
          </dl>
          <p className="mt-4 text-sm text-nova-ash">
            {method.instructions}
          </p>
        </div>

        {!isOnline && (
          <p className="max-w-sm text-sm text-nova-gild">
            You&rsquo;re offline — reconnect before confirming your payment.
          </p>
        )}

        <label className="flex max-w-sm items-start gap-3 text-sm text-nova-ash">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            required
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-nova-hairline bg-nova-crypt accent-nova-ember"
          />
          <span>
            I understand credentials are non-refundable once revealed. Read
            the{" "}
            <Link
              href="/refund-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-nova-ember-text underline underline-offset-2 hover:text-nova-ember-lo"
            >
              refund policy
            </Link>
            .
          </span>
        </label>

        {submitError && (
          <p className="max-w-sm rounded-md border border-nova-blood/30 bg-nova-blood/15 px-4 py-3 text-sm text-nova-bone">
            {submitError}
          </p>
        )}

        <Button
          type="button"
          variant="primary"
          disabled={!isOnline || !consentChecked || isSubmitting}
          onClick={async () => {
            if (submittingRef.current) return;
            submittingRef.current = true;
            setIsSubmitting(true);
            setSubmitError(null);
            track("claim_payment", { orderRef: order.paymentReference });
            const result = await markPaid();
            if (!result.ok) {
              setSubmitError(result.message);
              submittingRef.current = false;
              setIsSubmitting(false);
            }
            // No reset on success — this step unmounts as checkout-store advances to step 3.
          }}
          className="w-fit"
        >
          {isSubmitting ? "Submitting…" : "I have made the payment"}
        </Button>

        <p className="max-w-sm text-xs text-nova-smoke">
          Orders are typically verified within 1–2 hours during business
          hours (9am–9pm PKT).
        </p>
      </div>

      <aside className="flex h-fit flex-col items-center gap-2 rounded-lg border border-nova-hairline bg-nova-crypt p-6 text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-nova-smoke">
          Reservation expires in
        </span>
        {/* Session 9: no font-bold — see the amount-to-transfer span
            above for why. */}
        <span className="text-3xl font-display text-nova-ember-text">
          <CountdownTimer
            expiresAt={order.reservedUntil}
            onExpire={() => {
              markOrderExpired();
              setExpired(true);
            }}
          />
        </span>
      </aside>
    </div>
  );
}
