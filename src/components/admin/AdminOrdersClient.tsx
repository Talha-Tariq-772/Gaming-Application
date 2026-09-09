"use client";

import { useMemo, useState } from "react";
import OrderDetailPanel from "@/src/components/admin/OrderDetailPanel";
import OrdersTable from "@/src/components/admin/OrdersTable";
import { matchesOrderSearch } from "@/src/lib/order-search";
import type { Game, GiftCardProduct, Order, OrderItem, OrderStatus, PaymentMethod, Profile } from "@/src/types/database";

const STATUS_FILTERS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "under_review", label: "Under review" },
  { value: "payment_claimed", label: "Payment submitted" },
  { value: "awaiting_payment", label: "Awaiting payment" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "all", label: "All statuses" },
];

export default function AdminOrdersClient({
  orders,
  orderItems,
  customers,
  games,
  giftCardProductsByCodeId,
  paymentMethods,
}: {
  orders: Order[];
  orderItems: OrderItem[];
  customers: Profile[];
  games: Game[];
  giftCardProductsByCodeId: Record<string, GiftCardProduct>;
  paymentMethods: PaymentMethod[];
}) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("under_review");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // A non-empty query searches across every order regardless of status —
  // the whole point is finding one specific order fast (the agent has a
  // reference or a phone number, not necessarily a status), so it would
  // be actively unhelpful to have the status pills silently hide a match.
  const searchResults = useMemo(() => {
    if (!query.trim()) return null;
    return orders.filter((order) =>
      matchesOrderSearch(order, customers.find((c) => c.id === order.userId)?.phoneNumber, query),
    );
  }, [orders, query, customers]);

  const filtered = useMemo(() => {
    if (searchResults !== null) {
      return [...searchResults].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    const list = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);
    return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [orders, statusFilter, searchResults]);

  const selectedOrder = orders.find((o) => o.id === selectedId) ?? null;
  const selectedItems = selectedOrder ? orderItems.filter((i) => i.orderId === selectedOrder.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 id="orders-queue-heading" tabIndex={-1} className="font-display text-xl font-bold text-nova-bone">
          Verification Queue
        </h1>
        <p className="mt-1 text-sm text-nova-ash">Oldest first — the longest wait gets served first.</p>
      </div>

      <div className="max-w-md">
        <label htmlFor="order-search" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-nova-smoke">
          Find an order
        </label>
        <input
          id="order-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Paste order reference or phone"
          className="min-h-11 w-full rounded-md border border-nova-hairline bg-nova-crypt px-3 py-2 font-mono text-sm text-nova-bone placeholder:font-sans placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
        />
        {searchResults !== null && (
          <p className="mt-2 text-xs text-nova-smoke">
            {searchResults.length === 0
              ? "No order matches that reference or phone number."
              : `${searchResults.length} match${searchResults.length === 1 ? "" : "es"} — status filter below is ignored while searching.`}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`flex min-h-11 items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-(--duration-fast) ease-standard ${
              statusFilter === f.value
                ? "border-nova-ember bg-nova-ember-bright text-nova-void"
                : "border-nova-hairline text-nova-ash hover:border-nova-ember/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <OrdersTable orders={filtered} customers={customers} paymentMethods={paymentMethods} onSelect={setSelectedId} selectedId={selectedId} />

      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          items={selectedItems}
          customers={customers}
          games={games}
          giftCardProductsByCodeId={giftCardProductsByCodeId}
          paymentMethods={paymentMethods}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
