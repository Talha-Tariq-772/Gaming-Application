"use client";

import Link from "next/link";
import { useState } from "react";
import CopyButton from "@/src/components/checkout/CopyButton";
import PaymentScreenshotUpload from "@/src/components/checkout/PaymentScreenshotUpload";
import { useAuth } from "@/src/contexts/AuthContext";
import { PAYMENT_VERIFICATION_FAQ_SLUG } from "@/src/lib/faq-anchors";
import { SITE_URL } from "@/src/lib/site-config";
import type { Order, PaymentMethod } from "@/src/types/database";

/**
 * Final checkout step. The payment screenshot is uploaded HERE now rather
 * than sent over WhatsApp, so this is where an order stops being a
 * promise and becomes reviewable.
 *
 * The upload is what unblocks admin review: approve_order refuses an
 * order with no screenshot at the DATABASE level
 * (20260921000005_payment_screenshots.sql), so this is not merely a
 * prompt — nothing ships until it is done.
 *
 * A GUEST gets their /order-status/<token> link here, and this is the only
 * time it is ever shown. It replaces WhatsApp as the return path: it is
 * how they check status and upload (or replace) a screenshot later,
 * with no sign-in.
 */
export default function StepConfirmation({
  order,
  lookupToken,
  paymentMethods,
}: {
  order: Order;
  /** Null only when the persisted checkout store predates this field —
   * the guest link is omitted rather than rendered as a broken URL. */
  lookupToken: string | null;
  paymentMethods: PaymentMethod[];
}) {
  const { profile } = useAuth();
  const [uploaded, setUploaded] = useState(false);
  // Kept in the props contract (CheckoutFlow passes it for every step)
  // but no longer read here: the WhatsApp handoff that needed the method
  // label is gone.
  void paymentMethods;

  const statusUrl = lookupToken ? `${SITE_URL}/order-status/${lookupToken}` : null;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 text-center">
      <span className="text-xs font-semibold uppercase tracking-wider text-nova-smoke">
        Order Reference
      </span>
      {/* Session 9: no font-extrabold — text-4xl isn't covered by the
          .font-display compound rules (globals.css), so this was
          requesting a weight Marcellus doesn't ship. */}
      <span className="text-4xl font-display text-nova-bone">{order.paymentReference}</span>
      <span className="inline-flex items-center rounded-full border border-nova-ember bg-nova-crypt px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-nova-ember-text">
        {uploaded ? "Awaiting Verification" : "Screenshot Needed"}
      </span>

      <div className="w-full text-left">
        <PaymentScreenshotUpload
          orderId={order.id}
          lookupToken={lookupToken ?? undefined}
          onUploaded={() => setUploaded(true)}
        />
      </div>

      {!uploaded && (
        <p className="text-sm text-nova-ash">
          Your order can&rsquo;t be checked until we have this, so upload it now if you can.
        </p>
      )}

      {/* Guests ONLY, and only here: a signed-in buyer reaches the same
          order through their account, so handing them a bearer token as
          well would be a second, weaker way into it. */}
      {!profile && statusUrl && (
        <div className="w-full rounded-lg border border-nova-hairline bg-nova-crypt p-4 text-left">
          <p className="text-sm font-semibold text-nova-bone">Save this link</p>
          <p className="mt-1 text-xs text-nova-ash">
            It&rsquo;s your way back to this order &mdash; check the status or upload a different
            screenshot at any time. No sign-in needed.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-nova-hairline bg-nova-void px-3 py-2 font-mono text-xs text-nova-ash">
              {statusUrl}
            </code>
            <CopyButton value={statusUrl} />
          </div>
        </div>
      )}

      <p className="text-sm text-nova-ash">
        Orders are typically confirmed within 1&ndash;2 hours during business hours (9am&ndash;9pm
        PKT). Wondering how that works?{" "}
        <Link
          href={`/faq#${PAYMENT_VERIFICATION_FAQ_SLUG}`}
          className="font-semibold text-nova-ember-text hover:text-nova-ember-lo"
        >
          See the payment FAQ
        </Link>
        .
      </p>

      {profile ? (
        <Link
          href="/account"
          className="text-sm font-semibold text-nova-ember-text hover:text-nova-ember-lo"
        >
          Track your order status &rarr;
        </Link>
      ) : (
        lookupToken && (
          <Link
            href={`/order-status/${lookupToken}`}
            className="text-sm font-semibold text-nova-ember-text hover:text-nova-ember-lo"
          >
            Track your order status &rarr;
          </Link>
        )
      )}
    </div>
  );
}
