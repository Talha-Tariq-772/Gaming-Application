import StatusBadge from "@/src/components/account/StatusBadge";
import { getOrderAgeLabel } from "@/src/lib/admin-stats";
import { formatPrice } from "@/src/lib/format";
import type { Order, PaymentMethod, Profile } from "@/src/types/database";

export default function OrdersTable({
  orders,
  customers,
  paymentMethods,
  onSelect,
  selectedId,
}: {
  orders: Order[];
  customers: Profile[];
  paymentMethods: PaymentMethod[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-1 px-4 py-12 text-center text-sm text-text-muted">
        No orders match this filter.
      </div>
    );
  }

  const rows = orders.map((order) => ({
    order,
    customer: customers.find((p) => p.id === order.userId),
    method: paymentMethods.find((m) => m.id === order.paymentMethodId),
  }));

  return (
    <>
      {/* Table — md and up */}
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-1 text-xs uppercase tracking-wider text-text-faint">
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Age</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ order, customer, method }) => (
              <tr
                key={order.id}
                onClick={() => onSelect(order.id)}
                tabIndex={0}
                role="button"
                aria-label={`View order ${order.paymentReference}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(order.id);
                  }
                }}
                className={`cursor-pointer border-b border-border transition-colors duration-(--duration-fast) ease-standard last:border-b-0 hover:bg-surface-1 ${
                  selectedId === order.id ? "bg-surface-1" : "bg-bg"
                }`}
              >
                <td className="px-4 py-3 font-mono text-text">
                  {order.paymentReference}
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {customer?.fullName ?? "—"}
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {customer?.phoneNumber ?? "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-text">
                  {formatPrice(order.amountExact)}
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {method?.label ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 text-right text-text-faint">
                  {getOrderAgeLabel(order.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked cards — below md */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map(({ order, customer, method }) => (
          <button
            key={order.id}
            type="button"
            onClick={() => onSelect(order.id)}
            className={`flex flex-col gap-3 rounded-lg border p-4 text-left transition-colors duration-(--duration-fast) ease-standard ${
              selectedId === order.id
                ? "border-accent bg-surface-1"
                : "border-border bg-bg"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-sm font-semibold text-text">
                {order.paymentReference}
              </span>
              <StatusBadge status={order.status} />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-text">
                  {customer?.fullName ?? "—"}
                </p>
                <p className="truncate text-xs text-text-faint">
                  {customer?.phoneNumber ?? "—"} · {method?.label ?? "—"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-text">
                  {formatPrice(order.amountExact)}
                </p>
                <p className="text-xs text-text-faint">
                  {getOrderAgeLabel(order.createdAt)}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
