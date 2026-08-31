"use client";

import { useRef, useState } from "react";
import Button from "@/components/Button";
import { useAuth } from "@/src/contexts/AuthContext";
import { track } from "@/src/lib/analytics";
import { formatPrice } from "@/src/lib/format";
import { useCartSummary } from "@/src/lib/use-cart";
import { useOnlineStatus } from "@/src/lib/use-online-status";
import { phoneSchema } from "@/src/lib/validation";
import { useCartStore } from "@/src/stores/cart-store";
import { useCartUIStore } from "@/src/stores/cart-ui-store";
import { useCheckoutStore } from "@/src/stores/checkout-store";
import type { PaymentMethod } from "@/src/types/database";
import PaymentMethodCard from "./PaymentMethodCard";

export default function StepPaymentMethod({
  paymentMethods,
  cartTotal,
}: {
  paymentMethods: PaymentMethod[];
  cartTotal: number;
}) {
  const paymentMethodId = useCheckoutStore((s) => s.paymentMethodId);
  const setPaymentMethodId = useCheckoutStore((s) => s.setPaymentMethodId);
  const phoneNumber = useCheckoutStore((s) => s.phoneNumber);
  const setPhoneNumber = useCheckoutStore((s) => s.setPhoneNumber);
  const confirmMethodAndPhone = useCheckoutStore(
    (s) => s.confirmMethodAndPhone,
  );
  const clearCart = useCartStore((s) => s.clearCart);
  const openCart = useCartUIStore((s) => s.open);
  // Re-validated here (not just trusted from CartDrawer's own gate) since
  // /checkout is reachable directly by URL, bypassing the drawer entirely.
  const { validItems, hasUnavailableItem } = useCartSummary();
  const isOnline = useOnlineStatus();
  const { profile } = useAuth();

  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const phoneResult = phoneSchema.safeParse(phoneNumber);
  const phoneValid = phoneResult.success;
  const phoneError = phoneResult.success
    ? null
    : phoneResult.error.issues[0]?.message;

  const canContinue =
    Boolean(paymentMethodId) &&
    phoneValid &&
    Boolean(profile) &&
    !hasUnavailableItem &&
    isOnline &&
    !isSubmitting;

  async function handleContinue() {
    // Belt-and-braces against a double-click landing both calls before
    // the disabled state re-renders — the ref is checked synchronously,
    // the state is what actually disables the button visually.
    if (submittingRef.current || !canContinue || !profile || !phoneResult.success) {
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    setPhoneNumber(phoneResult.data); // store the normalized canonical form
    const result = await confirmMethodAndPhone(validItems, profile.id);
    if (!result.ok) {
      setSubmitError(result.message);
      submittingRef.current = false;
      setIsSubmitting(false);
      return;
    }
    clearCart();
    // No reset of isSubmitting on success — this step unmounts as soon as
    // checkout-store advances to step 2, so there's nothing left to
    // re-enable.
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-nova-smoke">
          {validItems.length} item{validItems.length === 1 ? "" : "s"} ·{" "}
          {formatPrice(cartTotal)}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paymentMethods.map((method) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              selected={paymentMethodId === method.id}
              onSelect={() => {
                setPaymentMethodId(method.id);
                track("select_payment_method", { method: method.label });
              }}
            />
          ))}
        </div>
      </div>

      <div className="max-w-sm">
        <label
          htmlFor="phone"
          className="mb-2 block text-xs font-semibold uppercase tracking-wider text-nova-smoke"
        >
          Phone Number
        </label>
        <input
          id="phone"
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="+92 3XX XXXXXXX"
          aria-invalid={touched && Boolean(phoneNumber) && !phoneValid}
          aria-describedby={
            touched && phoneNumber && !phoneValid ? "phone-error" : undefined
          }
          className="min-h-11 w-full rounded-md border border-nova-hairline bg-nova-crypt px-3 py-2 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
        />
        {touched && phoneNumber && !phoneValid && (
          <p id="phone-error" className="mt-2 text-xs text-nova-blood">
            {phoneError}
          </p>
        )}
      </div>

      {hasUnavailableItem && (
        <div className="max-w-sm rounded-md border border-nova-blood/30 bg-nova-blood/15 px-4 py-3 text-sm text-nova-bone">
          One or more items in your cart are no longer available.{" "}
          <button
            type="button"
            onClick={openCart}
            className="font-semibold underline underline-offset-2"
          >
            Open your cart
          </button>{" "}
          to remove them before continuing.
        </div>
      )}

      {submitError && (
        <div className="max-w-sm rounded-md border border-nova-blood/30 bg-nova-blood/15 px-4 py-3 text-sm text-nova-bone">
          {submitError}{" "}
          <button
            type="button"
            onClick={openCart}
            className="font-semibold underline underline-offset-2"
          >
            Open your cart
          </button>{" "}
          to review it.
        </div>
      )}

      {!isOnline && (
        <p className="max-w-sm text-sm text-nova-gild">
          You&rsquo;re offline — reconnect to continue checking out.
        </p>
      )}

      <Button
        type="button"
        variant="primary"
        disabled={!canContinue}
        onClick={handleContinue}
        className="w-fit"
      >
        {isSubmitting ? "Continuing…" : "Continue"}
      </Button>
    </div>
  );
}
