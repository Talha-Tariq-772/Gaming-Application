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
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface-1 px-6 py-24 text-center">
        <h2 className="font-display text-xl font-bold text-text">
          Reservation expired
        </h2>
        <p className="max-w-sm text-sm text-text-muted">
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
        <div className="rounded-lg border border-accent bg-surface-1 p-6 shadow-glow">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
            Amount to transfer
          </span>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <span className="text-4xl font-display font-extrabold text-text">
              {formatPrice(order.amountExact)}
            </span>
            <CopyButton
              value={String(order.amountExact)}
              label="Copy amount"
            />
          </div>
          <p className="mt-3 text-sm text-text-muted">
            Transfer this exact amount — the extra paisa is how we match
            your payment automatically.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface-1 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-faint">
            {method.label} details
          </h2>
          <dl className="flex flex-col gap-4">
            <div>
              <dt className="text-xs text-text-faint">Account Title</dt>
              <dd className="text-sm text-text">{method.accountTitle}</dd>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <dt className="text-xs text-text-faint">Account Number</dt>
                <dd className="font-mono text-sm text-text">
                  {method.accountNumber}
                </dd>
              </div>
              <CopyButton value={method.accountNumber} />
            </div>

            {method.iban && (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <dt className="text-xs text-text-faint">IBAN</dt>
                  <dd className="font-mono text-sm text-text">
                    {method.iban}
                  </dd>
                </div>
                <CopyButton value={method.iban} />
              </div>
            )}

            {method.raastId && (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <dt className="text-xs text-text-faint">RAAST ID</dt>
                  <dd className="font-mono text-sm text-text">
                    {method.raastId}
                  </dd>
                </div>
                <CopyButton value={method.raastId} />
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div>
                <dt className="text-xs text-text-faint">Reference</dt>
                <dd className="font-mono text-sm text-text">
                  {order.paymentReference}
                </dd>
              </div>
              <CopyButton value={order.paymentReference} />
            </div>
          </dl>
          <p className="mt-4 text-sm text-text-muted">
            {method.instructions}
          </p>
        </div>

        {!isOnline && (
          <p className="max-w-sm text-sm text-warning">
            You&rsquo;re offline — reconnect before confirming your payment.
          </p>
        )}

        <label className="flex max-w-sm items-start gap-3 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            required
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-surface-1 accent-accent"
          />
          <span>
            I understand credentials are non-refundable once revealed. Read
            the{" "}
            <Link
              href="/refund-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent underline underline-offset-2 hover:text-accent-strong"
            >
              refund policy
            </Link>
            .
          </span>
        </label>

        {submitError && (
          <p className="max-w-sm rounded-md border border-danger/30 bg-danger-dim px-4 py-3 text-sm text-danger">
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

        <p className="max-w-sm text-xs text-text-faint">
          Orders are typically verified within 1–2 hours during business
          hours (9am–9pm PKT).
        </p>
      </div>

      <aside className="flex h-fit flex-col items-center gap-2 rounded-lg border border-border bg-surface-1 p-6 text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
          Reservation expires in
        </span>
        <span className="text-3xl font-display font-bold text-accent">
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
