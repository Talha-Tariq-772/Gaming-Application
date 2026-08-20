import Link from "next/link";
import MagneticButton from "@/src/components/motion/MagneticButton";
import { track } from "@/src/lib/analytics";
import { buildWhatsAppLink } from "@/src/lib/order";
import { PAYMENT_VERIFICATION_FAQ_ID } from "@/src/lib/mock-guides";
import type { Order, PaymentMethod } from "@/src/types/database";

export default function StepConfirmation({
  order,
  paymentMethods,
}: {
  order: Order;
  paymentMethods: PaymentMethod[];
}) {
  const method = paymentMethods.find((m) => m.id === order.paymentMethodId);
  const whatsappLink = buildWhatsAppLink(
    order,
    method?.label ?? "your chosen method",
  );

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 text-center">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
        Order Reference
      </span>
      <span className="text-4xl font-display font-extrabold text-text">
        {order.paymentReference}
      </span>
      <span className="inline-flex items-center rounded-full border border-accent bg-surface-1 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
        Awaiting Verification
      </span>

      <MagneticButton
        as="a"
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        variant="primary"
        className="w-full sm:w-fit"
        onClick={() =>
          track("open_whatsapp", {
            context: "checkout-confirmation",
            orderRef: order.paymentReference,
          })
        }
      >
        Send Screenshot on WhatsApp
      </MagneticButton>

      <p className="text-sm text-text-muted">
        Send your payment screenshot to this WhatsApp number so we can
        verify it quickly.
      </p>

      <p className="text-sm text-text-muted">
        Orders are typically verified within 1–2 hours during business
        hours (9am–9pm PKT). Wondering how that works?{" "}
        <Link
          href={`/faq#${PAYMENT_VERIFICATION_FAQ_ID}`}
          className="font-semibold text-accent hover:text-accent-strong"
        >
          See the payment FAQ
        </Link>
        .
      </p>

      <Link
        href="/account"
        className="text-sm font-semibold text-accent hover:text-accent-strong"
      >
        Track your order status →
      </Link>
    </div>
  );
}
