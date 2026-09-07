import Link from "next/link";
import MagneticButton from "@/src/components/motion/MagneticButton";
import { useAuth } from "@/src/contexts/AuthContext";
import { track } from "@/src/lib/analytics";
import { buildWhatsAppLink } from "@/src/lib/order";
import { PAYMENT_VERIFICATION_FAQ_ID } from "@/src/lib/mock-guides";
import type { CheckoutOrderItem } from "@/src/stores/checkout-store";
import type { Order, PaymentMethod } from "@/src/types/database";

export default function StepConfirmation({
  order,
  orderItems,
  paymentMethods,
}: {
  order: Order;
  orderItems: CheckoutOrderItem[];
  paymentMethods: PaymentMethod[];
}) {
  const { profile } = useAuth();
  const method = paymentMethods.find((m) => m.id === order.paymentMethodId);
  const whatsappLink = buildWhatsAppLink(
    order,
    orderItems,
    method?.label ?? "your chosen method",
  );

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 text-center">
      <span className="text-xs font-semibold uppercase tracking-wider text-nova-smoke">
        Order Reference
      </span>
      {/* Session 9: no font-extrabold — text-4xl isn't covered by the
          .font-display compound rules (globals.css), so this was
          requesting a weight Marcellus doesn't ship. */}
      <span className="text-4xl font-display text-nova-bone">
        {order.paymentReference}
      </span>
      <span className="inline-flex items-center rounded-full border border-nova-ember bg-nova-crypt px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-nova-ember-text">
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

      <p className="text-sm text-nova-ash">
        Send your payment screenshot to this WhatsApp number so we can
        verify it quickly.
      </p>

      {/* No account exists for a guest — credentials are never revealed
          on-site for them. Say so plainly and give them the one thing
          they need to follow up: the reference, already shown above. */}
      {!profile && (
        <p className="text-sm text-nova-ash">
          We&rsquo;ll deliver your credentials on WhatsApp once payment is
          verified. Quote{" "}
          <span className="font-mono font-semibold text-nova-bone">
            {order.paymentReference}
          </span>{" "}
          if you follow up.
        </p>
      )}

      <p className="text-sm text-nova-ash">
        Orders are typically verified within 1–2 hours during business
        hours (9am–9pm PKT). Wondering how that works?{" "}
        <Link
          href={`/faq#${PAYMENT_VERIFICATION_FAQ_ID}`}
          className="font-semibold text-nova-ember-text hover:text-nova-ember-lo"
        >
          See the payment FAQ
        </Link>
        .
      </p>

      {profile && (
        <Link
          href="/account"
          className="text-sm font-semibold text-nova-ember-text hover:text-nova-ember-lo"
        >
          Track your order status →
        </Link>
      )}
    </div>
  );
}
