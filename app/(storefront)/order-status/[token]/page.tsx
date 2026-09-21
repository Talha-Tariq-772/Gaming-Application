import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PaymentScreenshotUpload from "@/src/components/checkout/PaymentScreenshotUpload";
import OrderTimeline from "@/src/components/account/OrderTimeline";
import StatusBadge from "@/src/components/account/StatusBadge";
import { formatPrice, formatPriceExact } from "@/src/lib/format";
import { findOrderByLookupToken } from "@/src/lib/order-lookup";

/**
 * No-login order status, reached by bearer token. This is a guest's only
 * route back to their own order — it replaces WhatsApp as the return
 * path, and unlike a one-shot message it works at any time.
 *
 * noindex/nofollow is not optional here. The URL contains a token that
 * grants access to a real order; a crawler following it (from a pasted
 * link in a public thread, say) would put it in an index.
 */
export const metadata: Metadata = {
  title: "Order status",
  robots: { index: false, follow: false, nocache: true },
};

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await findOrderByLookupToken(token);

  // A bad token and a missing order are the same 404 on purpose: a
  // distinct "invalid token" page would confirm which tokens are real.
  if (!result) notFound();

  const { order, items, paymentMethodLabel, hasScreenshot } = result;
  const isOpen = order.status === "awaiting_payment" || order.status === "payment_claimed";

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-nova-ember-text">
              Order
            </span>
            <h1 className="mt-2 font-display text-display-sm font-extrabold text-nova-bone">
              {order.paymentReference}
            </h1>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <section className="mt-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-nova-smoke">
            Items
          </h2>
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-nova-hairline bg-nova-crypt p-4"
              >
                <span className="text-sm font-semibold text-nova-bone">{item.title}</span>
                <span className="text-sm text-nova-ash">{formatPrice(item.price)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-nova-hairline pt-4">
            <span className="text-sm text-nova-ash">
              Amount{paymentMethodLabel ? ` · ${paymentMethodLabel}` : ""}
            </span>
            <span className="text-lg font-semibold text-nova-bone">
              {formatPriceExact(order.amountExact)}
            </span>
          </div>
        </section>

        {/* Upload stays available while the order is still open, so a
            buyer who sent the wrong image can fix it without contacting
            anyone. Once decided, the widget itself reports that it can no
            longer be changed. */}
        {isOpen && (
          <section className="mt-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-nova-smoke">
              Payment proof
            </h2>
            <PaymentScreenshotUpload orderId={order.id} lookupToken={token} />
          </section>
        )}

        {!isOpen && hasScreenshot && (
          <section className="mt-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-nova-smoke">
              Payment proof
            </h2>
            <p className="rounded-lg border border-nova-hairline bg-nova-crypt p-4 text-sm text-nova-ash">
              Your screenshot is on file for this order.
            </p>
          </section>
        )}

        <section className="mt-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-nova-smoke">
            Timeline
          </h2>
          <OrderTimeline order={order} />
        </section>

        <p className="mt-10 text-xs text-nova-smoke">
          Bookmark this page &mdash; it&rsquo;s your link to this order and doesn&rsquo;t need a
          sign-in. Keep it to yourself; anyone with the link can see this order.
        </p>
      </div>
    </div>
  );
}
