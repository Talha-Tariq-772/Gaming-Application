"use client";

import Link from "next/link";
import { track } from "@/src/lib/analytics";
import { formatDate } from "@/src/lib/date";
import { formatPrice } from "@/src/lib/format";
import { buildWhatsAppLink } from "@/src/lib/order";
import type { Game, Order, OrderItem, PaymentMethod } from "@/src/types/database";
import StatusBadge from "./StatusBadge";

const ACTIONABLE_STATUSES = new Set(["awaiting_payment", "payment_claimed", "under_review"]);

export default function OrderCard({
  order,
  items,
  games,
  paymentMethods,
}: {
  order: Order;
  items: OrderItem[];
  games: Game[];
  paymentMethods: PaymentMethod[];
}) {
  const titles = items
    .map((item) => games.find((g) => g.id === item.gameId)?.title)
    .filter((title): title is string => Boolean(title));

  const method = paymentMethods.find((m) => m.id === order.paymentMethodId);

  return (
    <div className="rounded-lg border border-nova-hairline bg-nova-crypt p-6">
      <Link
        href={`/account/orders/${order.id}`}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="font-mono text-lg font-bold text-nova-bone">
              {order.paymentReference}
            </span>
            <p className="mt-1 text-xs text-nova-smoke">
              {formatDate(order.createdAt)}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <p className="text-sm text-nova-ash">
          {titles.length > 0 ? titles.join(", ") : `${items.length} item(s)`}
        </p>

        <span className="text-lg font-semibold text-nova-bone">
          {formatPrice(order.amountExact)}
        </span>
      </Link>

      {order.status === "rejected" && order.rejectionReason && (
        <p className="mt-4 rounded-md border border-nova-blood/30 bg-nova-blood/15 px-4 py-3 text-sm text-nova-blood">
          {order.rejectionReason}
        </p>
      )}

      {ACTIONABLE_STATUSES.has(order.status) && method && (
        <a
          href={buildWhatsAppLink(order, method.label)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            track("open_whatsapp", {
              context: "account",
              orderRef: order.paymentReference,
            })
          }
          className="-mb-2.5 mt-4 flex min-h-11 w-fit items-center gap-2 py-2.5 text-sm font-semibold text-nova-ember transition-colors duration-(--duration-fast) ease-standard hover:text-nova-ember-lo"
        >
          Send your screenshot to WhatsApp →
        </a>
      )}
    </div>
  );
}
