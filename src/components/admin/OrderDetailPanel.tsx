"use client";

import { useState } from "react";
import AdminButton from "@/src/components/admin/AdminButton";
import AdminSlideOver from "@/src/components/admin/AdminSlideOver";
import StatusBadge from "@/src/components/account/StatusBadge";
import { useAuth } from "@/src/contexts/AuthContext";
import { formatDateTime } from "@/src/lib/date";
import { formatPrice, formatPriceExact } from "@/src/lib/format";
import { track } from "@/src/lib/analytics";
import { approveOrder, rejectOrder } from "@/src/lib/actions/admin-orders";
import { buildWhatsAppLink } from "@/src/lib/order";
import { formatGiftCardProductVariant, toWhatsAppOrderItems } from "@/src/lib/order-item-display";
import { useToastStore } from "@/src/stores/toast-store";
import type { Game, GiftCardProduct, Order, OrderItem, PaymentMethod, Profile } from "@/src/types/database";
import ApproveConfirmDialog from "./ApproveConfirmDialog";
import RejectDialog from "./RejectDialog";

const DECIDABLE_STATUSES = new Set(["under_review", "payment_claimed"]);

/** A decided order usually drops out of the current status filter, so the
 * row that opened this panel is gone by the time it closes — the focus
 * trap's normal "return focus to the trigger" has nothing left to return
 * to. Both admin pages that render this panel give their h1 this id as a
 * stable fallback landing spot. */
const DECISION_FOCUS_FALLBACK_ID = "orders-queue-heading";

function focusDecisionFallback() {
  document.getElementById(DECISION_FOCUS_FALLBACK_ID)?.focus();
}

export default function OrderDetailPanel({
  order,
  items,
  customers,
  games,
  giftCardProductsByCodeId,
  paymentMethods,
  onClose,
}: {
  order: Order;
  items: OrderItem[];
  customers: Profile[];
  games: Game[];
  giftCardProductsByCodeId: Record<string, GiftCardProduct>;
  paymentMethods: PaymentMethod[];
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const showToast = useToastStore((s) => s.showToast);
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [deciding, setDeciding] = useState(false);
  // While a nested confirm dialog is open, it owns Escape/Tab (its own
  // useFocusTrap listener is registered after this one, so both would
  // otherwise fire on the same keypress) — suppress this panel's own
  // close-on-Escape until the nested dialog handles it and unmounts.
  const nestedDialogOpen = showApprove || showReject;

  const customer = customers.find((p) => p.id === order.userId);
  const method = paymentMethods.find((m) => m.id === order.paymentMethodId);
  const canDecide = DECIDABLE_STATUSES.has(order.status);

  // approve_order()/reject_order() (server-side, service role) handle the
  // payment_claimed -> under_review hop internally now — see
  // supabase/migrations/20260819000002_order_lifecycle_functions.sql.
  async function handleApprove() {
    if (!profile) return;
    setDeciding(true);
    const result = await approveOrder(order.id, profile.id);
    setDeciding(false);
    if (!result.ok) {
      showToast(result.message);
      return;
    }
    showToast(`${order.paymentReference} approved`);
    focusDecisionFallback();
    setShowApprove(false);
    onClose();
  }

  async function handleReject(reason: string) {
    if (!profile) return;
    setDeciding(true);
    const result = await rejectOrder(order.id, profile.id, reason);
    setDeciding(false);
    if (!result.ok) {
      showToast(result.message);
      return;
    }
    showToast(`${order.paymentReference} rejected`);
    focusDecisionFallback();
    setShowReject(false);
    onClose();
  }

  return (
    <>
      <AdminSlideOver
        onClose={() => {
          if (!nestedDialogOpen) onClose();
        }}
        titleId="order-detail-heading"
        title={
          <div className="flex flex-col gap-2">
            <h2 id="order-detail-heading" className="font-mono text-lg font-bold text-nova-bone">
              {order.paymentReference}
            </h2>
            <StatusBadge status={order.status} />
          </div>
        }
        footer={
          canDecide && (
            <div className="flex gap-3 border-t border-nova-hairline px-5 py-4">
              <AdminButton
                variant="destructive"
                className="flex-1"
                onClick={() => setShowReject(true)}
                disabled={deciding}
              >
                Reject
              </AdminButton>
              <AdminButton
                variant="primary"
                className="flex-1"
                onClick={() => setShowApprove(true)}
                disabled={deciding}
              >
                Approve
              </AdminButton>
            </div>
          )
        }
      >
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-nova-smoke">
            Customer
          </h3>
          <p className="text-sm text-nova-bone">{customer?.fullName ?? "Unknown"}</p>
          <p className="text-sm text-nova-ash">
            {customer?.phoneNumber ?? "—"}
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-nova-smoke">
            Items
          </h3>
          <div className="flex flex-col gap-2">
            {items.map((item) => {
              if (item.productType === "gift_card") {
                const product = item.giftCardCodeId ? giftCardProductsByCodeId[item.giftCardCodeId] : undefined;
                return (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-nova-bone">
                      {product ? `${product.title} (${formatGiftCardProductVariant(product)})` : "Gift card"}
                    </span>
                    <span className="text-nova-ash">{formatPrice(item.price)}</span>
                  </div>
                );
              }
              const game = games.find((g) => g.id === item.gameId);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-nova-bone">{game?.title ?? item.gameId}</span>
                  <span className="text-nova-ash">
                    {formatPrice(item.price)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-md border border-nova-ember bg-nova-slab p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-nova-smoke">
            Exact amount to match
          </h3>
          <p className="mt-1 text-2xl font-bold text-nova-bone">
            {formatPriceExact(order.amountExact)}
          </p>
          <p className="mt-1 text-xs text-nova-ash">
            via {method?.label ?? "—"}
          </p>
        </section>

        {order.status === "rejected" && order.rejectionReason && (
          <section className="rounded-md border border-nova-blood/30 bg-nova-blood/15 p-4 text-sm text-nova-blood">
            {order.rejectionReason}
          </section>
        )}

        <section className="flex flex-col gap-1 text-xs text-nova-smoke">
          <span>Placed {formatDateTime(order.createdAt)}</span>
          {order.claimedAt && <span>Claimed {formatDateTime(order.claimedAt)}</span>}
          {order.reviewedAt && (
            <span>Reviewed {formatDateTime(order.reviewedAt)}</span>
          )}
          {/* Dispute evidence — the buyer checked the non-refundable-once-
              revealed box on the payment step before this order could be
              marked paid. */}
          {order.refundPolicyConsentedAt && (
            <span>
              Refund policy accepted{" "}
              {formatDateTime(order.refundPolicyConsentedAt)}
            </span>
          )}
        </section>

        {customer && method && (
          <a
            href={buildWhatsAppLink(
              order,
              toWhatsAppOrderItems(items, games, giftCardProductsByCodeId),
              method.label,
            )}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              track("open_whatsapp", {
                context: "admin",
                orderRef: order.paymentReference,
              })
            }
            className="text-sm font-semibold text-nova-ember-text hover:text-nova-ember-lo"
          >
            Message customer on WhatsApp →
          </a>
        )}
      </AdminSlideOver>

      {showApprove && (
        <ApproveConfirmDialog
          order={order}
          onCancel={() => setShowApprove(false)}
          onConfirm={handleApprove}
        />
      )}
      {showReject && (
        <RejectDialog
          onCancel={() => setShowReject(false)}
          onConfirm={handleReject}
        />
      )}
    </>
  );
}
