"use client";

import { useEffect, useRef } from "react";
import Button from "@/components/Button";
import { track } from "@/src/lib/analytics";
import { useHydrated } from "@/src/lib/use-hydrated";
import { useCartSummary } from "@/src/lib/use-cart";
import { useCartStore } from "@/src/stores/cart-store";
import { useCheckoutStore } from "@/src/stores/checkout-store";
import type { PaymentMethod } from "@/src/types/database";
import StepConfirmation from "./StepConfirmation";
import StepPaymentInstructions from "./StepPaymentInstructions";
import StepPaymentMethod from "./StepPaymentMethod";

const STEP_LABELS = ["Payment Method", "Payment Instructions", "Confirmation"];

export default function CheckoutFlow({
  paymentMethods,
}: {
  paymentMethods: PaymentMethod[];
}) {
  const hydrated = useHydrated();
  const step = useCheckoutStore((s) => s.step);
  const order = useCheckoutStore((s) => s.order);
  const resetCheckout = useCheckoutStore((s) => s.resetCheckout);
  const cartItems = useCartStore((s) => s.items);
  const { total: cartTotal } = useCartSummary();

  const beginCheckoutFired = useRef(false);
  useEffect(() => {
    if (
      !beginCheckoutFired.current &&
      hydrated &&
      step === 1 &&
      cartItems.length > 0
    ) {
      beginCheckoutFired.current = true;
      track("begin_checkout", { itemCount: cartItems.length, cartTotal });
    }
  }, [hydrated, step, cartItems.length, cartTotal]);

  // Defensive recovery: persisted state can end up inconsistent (e.g.
  // localStorage edited by hand, or partial writes) — fall back to step 1
  // rather than rendering a step 2/3 with no order to show.
  useEffect(() => {
    if (hydrated && step !== 1 && !order) {
      resetCheckout();
    }
  }, [hydrated, step, order, resetCheckout]);

  // NOTE: there used to be a second effect here that caught an admin
  // approving/rejecting this order (in another tab, or between visits)
  // while the buyer was still sitting on this wizard, and bounced them to
  // /account/orders/[id] to see the decision. It cross-checked against
  // useAllOrders(), which only ever contained mock/local-store orders —
  // once orders became real (session 3) it was already a permanent no-op
  // for any real order, just not obviously so. Removed rather than left as
  // dead code that looks like it's doing something. Catching a live status
  // change here for real would need polling or a realtime subscription;
  // out of scope for this pass — the buyer will still see the correct
  // status on /account whenever they revisit it.

  if (!hydrated) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto max-w-page px-4 py-24 md:px-8"
      >
        <span className="sr-only">Loading…</span>
        <div
          aria-hidden="true"
          className="h-64 rounded-lg border border-border bg-surface-1"
        />
      </div>
    );
  }

  if (step === 1 && cartItems.length === 0) {
    return (
      <div className="mx-auto flex max-w-page flex-col items-center gap-4 px-4 py-24 text-center md:px-8">
        <h1 className="text-display-sm font-display font-extrabold text-text">
          Your cart is empty
        </h1>
        <p className="max-w-sm text-sm text-text-muted">
          Add a few games to your cart before checking out.
        </p>
        <Button as="a" href="/games" variant="secondary">
          Browse Store
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <div className="mb-12">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Checkout
        </span>
        <h1 className="mt-2 text-display-sm font-display font-extrabold text-text">
          {STEP_LABELS[step - 1]}
        </h1>
        <ol className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wider text-text-faint">
          {STEP_LABELS.map((label, i) => (
            <li key={label} className="flex items-center gap-3">
              <span
                className={`flex items-center gap-2 ${
                  i + 1 <= step ? "text-accent" : ""
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                    i + 1 <= step ? "border-accent" : "border-border"
                  }`}
                >
                  {i + 1}
                </span>
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <span className="h-px w-6 bg-border" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </div>

      {step === 1 && (
        <StepPaymentMethod
          paymentMethods={paymentMethods}
          cartTotal={cartTotal}
        />
      )}
      {step === 2 && order && (
        <StepPaymentInstructions order={order} paymentMethods={paymentMethods} />
      )}
      {step === 3 && order && (
        <StepConfirmation order={order} paymentMethods={paymentMethods} />
      )}
    </div>
  );
}
