"use client";

import { useMemo, useState } from "react";
import OrderDetailPanel from "@/src/components/admin/OrderDetailPanel";
import OrdersTable from "@/src/components/admin/OrdersTable";
import type { Game, Order, OrderItem, OrderStatus, PaymentMethod, Profile } from "@/src/types/database";

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
  paymentMethods,
}: {
  orders: Order[];
  orderItems: OrderItem[];
  customers: Profile[];
  games: Game[];
  paymentMethods: PaymentMethod[];
}) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("under_review");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);
    return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [orders, statusFilter]);

  const selectedOrder = orders.find((o) => o.id === selectedId) ?? null;
  const selectedItems = selectedOrder ? orderItems.filter((i) => i.orderId === selectedOrder.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 id="orders-queue-heading" tabIndex={-1} className="text-xl font-bold text-nova-bone">
          Verification Queue
        </h1>
        <p className="mt-1 text-sm text-nova-ash">Oldest first — the longest wait gets served first.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`flex min-h-11 items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-(--duration-fast) ease-standard ${
              statusFilter === f.value
                ? "border-nova-ember bg-nova-ember-lo text-nova-bone"
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
          paymentMethods={paymentMethods}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
