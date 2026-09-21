"use client";

import { useEffect, useRef } from "react";
import CopyButton from "@/src/components/checkout/CopyButton";
import { track } from "@/src/lib/analytics";
import { buildCustomerWhatsAppLink, buildOrderConfirmedMessage, type WhatsAppOrderItem } from "@/src/lib/order";
import { formatPhoneDisplay, normalisePhone, toWaMeNumber } from "@/src/lib/phone";
import type { Order } from "@/src/types/database";

/**
 * "Tell the customer" — shown on an approved order.
 *
 * Generates a wa.me link to the CUSTOMER's number with the confirmation
 * pre-filled. Nothing is sent from here: the link opens WhatsApp's
 * composer, and the admin reads the message and presses Send themselves.
 * That is also why the full message is previewed on screen — the admin
 * should know exactly what they're about to send before they click.
 *
 * With no usable number (a profile that never completed its phone, or a
 * malformed one) there is no link to build, so the card says so and
 * offers the text to copy instead of rendering a dead button.
 */
export default function CustomerConfirmationCard({
  order,
  items,
  paymentMethodLabel,
  customerPhone,
  justApproved,
}: {
  order: Pick<Order, "paymentReference" | "amountExact">;
  items: WhatsAppOrderItem[];
  paymentMethodLabel: string | null;
  /** Either stored format — profiles keep "+92 300 1234567",
   * guest_phone keeps "+923001234567". */
  customerPhone: string | null | undefined;
  /** True right after this admin approved it, which gets the stronger
   * "do this now" framing; false for an order approved earlier. */
  justApproved: boolean;
}) {
  const message = buildOrderConfirmedMessage(order, items, paymentMethodLabel);
  const link = buildCustomerWhatsAppLink(toWaMeNumber(customerPhone), message);
  const e164 = customerPhone ? normalisePhone(customerPhone) : null;
  const sectionRef = useRef<HTMLElement>(null);

  // Approve lives in the panel footer; this card renders at the TOP of the
  // panel. Without this the admin approves, sees no change in view, and
  // may close the panel without ever noticing the message to send.
  useEffect(() => {
    if (justApproved) sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [justApproved]);

  return (
    <section
      ref={sectionRef}
      data-testid="customer-confirmation"
      className={`flex flex-col gap-3 rounded-md border p-4 ${
        justApproved ? "border-nova-ember bg-nova-ember/10" : "border-nova-hairline bg-nova-slab"
      }`}
    >
      <div>
        <h3 className="text-sm font-semibold text-nova-bone">
          {justApproved ? "Approved — let the customer know" : "Customer confirmation"}
        </h3>
        <p className="mt-1 text-xs text-nova-ash">
          {link
            ? `Opens WhatsApp with this message ready for ${e164 ? formatPhoneDisplay(e164) : "the customer"}. Nothing is sent until you press Send.`
            : "No usable phone number on this order, so there's no chat to open. Copy the message and send it another way."}
        </p>
      </div>

      <pre
        data-testid="confirmation-preview"
        className="whitespace-pre-wrap rounded-md border border-nova-hairline bg-nova-void p-3 font-sans text-xs text-nova-ash"
      >
        {message}
      </pre>

      <div className="flex flex-wrap items-center gap-2">
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="confirmation-whatsapp-link"
            onClick={() =>
              track("open_whatsapp", { context: "admin-approval", orderRef: order.paymentReference })
            }
            className="inline-flex min-h-11 items-center rounded-md bg-nova-ember-bright px-4 py-2 text-sm font-semibold text-nova-void hover:bg-nova-ember-bright-hover"
          >
            Send confirmation on WhatsApp &rarr;
          </a>
        )}
        <CopyButton value={message} label="Copy message" />
      </div>
    </section>
  );
}
