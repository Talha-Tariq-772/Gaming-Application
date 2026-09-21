"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AdminButton from "@/src/components/admin/AdminButton";
import AdminSlideOver from "@/src/components/admin/AdminSlideOver";
import StatusBadge from "@/src/components/account/StatusBadge";
import { useAuth } from "@/src/contexts/AuthContext";
import { formatDateTime } from "@/src/lib/date";
import { formatPrice, formatPriceExact } from "@/src/lib/format";
import { track } from "@/src/lib/analytics";
import { approveOrder, rejectOrder } from "@/src/lib/actions/admin-orders";
import { buildCustomerWhatsAppLink } from "@/src/lib/order";
import { formatPhoneDisplay, normalisePhone, toWaMeNumber } from "@/src/lib/phone";
import { formatGiftCardProductVariant, toWhatsAppOrderItems } from "@/src/lib/order-item-display";
import { useToastStore } from "@/src/stores/toast-store";
import { HARDWARE_CATEGORY_LABELS } from "@/src/types/database";
import type { Game, GiftCardProduct, HardwareProduct, Order, OrderItem, PaymentMethod, Profile } from "@/src/types/database";
import CustomerConfirmationCard from "./CustomerConfirmationCard";
import PaymentScreenshotPanel from "./PaymentScreenshotPanel";
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
  hardwareById,
  paymentMethods,
  onClose,
}: {
  order: Order;
  items: OrderItem[];
  customers: Profile[];
  games: Game[];
  giftCardProductsByCodeId: Record<string, GiftCardProduct>;
  hardwareById: Record<string, HardwareProduct>;
  paymentMethods: PaymentMethod[];
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  // Set when THIS admin approves from this panel. The `order` prop is
  // the list's snapshot and still says under_review/payment_claimed, so
  // this is what the panel renders from afterwards — it stays open to
  // offer the customer confirmation instead of vanishing on approve.
  const [approvedOrder, setApprovedOrder] = useState<Order | null>(null);
  const [showApprove, setShowApprove] = useState(false);
  // Mirrors the database rule (approve_order raises NO_PAYMENT_SCREENSHOT)
  // in the UI, so the admin sees WHY they can't approve instead of
  // clicking and getting an error. Starts null = "not checked yet", which
  // is distinct from false: the button stays disabled while loading
  // rather than flickering enabled.
  const [hasScreenshot, setHasScreenshot] = useState<boolean | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [deciding, setDeciding] = useState(false);
  // While a nested confirm dialog is open, it owns Escape/Tab (its own
  // useFocusTrap listener is registered after this one, so both would
  // otherwise fire on the same keypress) — suppress this panel's own
  // close-on-Escape until the nested dialog handles it and unmounts.
  const nestedDialogOpen = showApprove || showReject;

  const current = approvedOrder ?? order;
  const customer = customers.find((p) => p.id === current.userId);
  const method = paymentMethods.find((m) => m.id === current.paymentMethodId);
  const canDecide = DECIDABLE_STATUSES.has(current.status);
  // A guest has no profile, but did give a number at checkout.
  const customerPhone = customer?.phoneNumber ?? current.guestPhone;
  const customerPhoneE164 = customerPhone ? normalisePhone(customerPhone) : null;
  const whatsAppItems = toWhatsAppOrderItems(items, games, giftCardProductsByCodeId, hardwareById);

  /** Closing after a decision: the list's own snapshot is now stale (the
   * order has left its status filter), so refetch the server props rather
   * than leave a decided order sitting in "Under review". */
  function closeAfterDecision() {
    focusDecisionFallback();
    onClose();
    router.refresh();
  }

  // approve_order()/reject_order() (server-side, service role) handle the
  // payment_claimed -> under_review hop internally now — see
  // supabase/migrations/20260819000002_order_lifecycle_functions.sql.
  async function handleApprove() {
    if (!profile) return;
    setDeciding(true);
    try {
      const result = await approveOrder(order.id, profile.id);
      if (!result.ok) {
        showToast(result.message);
        return;
      }
      showToast(`${order.paymentReference} approved`);
      setShowApprove(false);
      // Stay open: the next step is telling the customer, and the
      // confirmation card needs this panel to show it.
      setApprovedOrder(result.order);
    } catch (e) {
      console.error("[OrderDetailPanel] approve", e);
      showToast("Couldn't reach the server. The order was not approved — try again.");
    } finally {
      setDeciding(false);
    }
  }

  async function handleReject(reason: string) {
    if (!profile) return;
    setDeciding(true);
    try {
      const result = await rejectOrder(order.id, profile.id, reason);
      if (!result.ok) {
        showToast(result.message);
        return;
      }
      showToast(`${order.paymentReference} rejected`);
      setShowReject(false);
      closeAfterDecision();
    } catch (e) {
      console.error("[OrderDetailPanel] reject", e);
      showToast("Couldn't reach the server. The order was not rejected — try again.");
    } finally {
      setDeciding(false);
    }
  }

  return (
    <>
      <AdminSlideOver
        onClose={() => {
          if (nestedDialogOpen) return;
          if (approvedOrder) closeAfterDecision();
          else onClose();
        }}
        titleId="order-detail-heading"
        title={
          <div className="flex flex-col gap-2">
            <h2 id="order-detail-heading" className="font-mono text-lg font-bold text-nova-bone">
              {order.paymentReference}
            </h2>
            <StatusBadge status={current.status} />
          </div>
        }
        footer={
          approvedOrder ? (
            <div className="flex gap-3 border-t border-nova-hairline px-5 py-4">
              <AdminButton variant="secondary" className="flex-1" onClick={closeAfterDecision}>
                Done
              </AdminButton>
            </div>
          ) : canDecide && (
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
                disabled={deciding || hasScreenshot !== true}
                title={
                  hasScreenshot === false
                    ? "The buyer hasn't uploaded a payment screenshot yet"
                    : undefined
                }
              >
                Approve
              </AdminButton>
            </div>
          )
        }
      >
        {current.status === "approved" && (
          <CustomerConfirmationCard
            order={current}
            items={whatsAppItems}
            paymentMethodLabel={method?.label ?? null}
            customerPhone={customerPhone}
            justApproved={approvedOrder !== null}
          />
        )}

        <PaymentScreenshotPanel orderId={order.id} onLoaded={setHasScreenshot} />

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-nova-smoke">
            Customer
          </h3>
          {/* A guest has no profile, but does have the number the order was
              placed with — the same one the confirmation link targets. */}
          <p className="text-sm text-nova-bone">
            {customer?.fullName ?? (current.userId ? "Unknown" : "Guest checkout")}
          </p>
          <p className="text-sm text-nova-ash">
            {customerPhoneE164 ? formatPhoneDisplay(customerPhoneE164) : (customerPhone ?? "—")}
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-nova-smoke">
            Items
          </h3>
          <div className="flex flex-col gap-2">
            {items.map((item) => {
              if (item.productType === "hardware") {
                const product = item.hardwareProductId
                  ? hardwareById[item.hardwareProductId]
                  : undefined;
                return (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-nova-bone">
                      {product
                        ? `${product.name} (${HARDWARE_CATEGORY_LABELS[product.category]})`
                        : "Hardware"}
                    </span>
                    <span className="text-nova-ash">{formatPrice(item.price)}</span>
                  </div>
                );
              }
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

        {/* Used to call buildWhatsAppLink, which targets
            SUPPORT_WHATSAPP_NUMBER — so "Message customer" opened a chat
            with our own support line. It now opens the CUSTOMER's chat,
            and works for guests too (guest_phone) where it was previously
            hidden for lack of a profile. */}
        {toWaMeNumber(customerPhone) && (
          <a
            href={
              buildCustomerWhatsAppLink(
                toWaMeNumber(customerPhone),
                `Hi, this is PSCBUNDLE about your order ${current.paymentReference}.`,
              ) ?? undefined
            }
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
