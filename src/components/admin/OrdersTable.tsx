import StatusBadge from "@/src/components/account/StatusBadge";
import { getOrderAgeLabel } from "@/src/lib/admin-stats";
import { formatPriceExact } from "@/src/lib/format";
import { formatPhoneDisplay, normalisePhone } from "@/src/lib/phone";
import type { Order, PaymentMethod, Profile } from "@/src/types/database";

/** Reconciles the two phone sources this table draws from — a signed-in
 * customer's profiles.phone_number (spaced, "+92 325 6525755") and a
 * guest's orders.guest_phone (tight E.164, "+923256525755") — to the same
 * displayed format. Falls back to the raw value if it somehow isn't a
 * normalisable PK mobile number, rather than hiding it. */
function displayPhone(raw: string | null | undefined): string {
  if (!raw) return "—";
  const normalised = normalisePhone(raw);
  return normalised ? formatPhoneDisplay(normalised) : raw;
}

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
      <div className="rounded-lg border border-nova-hairline bg-nova-crypt px-4 py-12 text-center text-sm text-nova-ash">
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
      {/* Table — md and up. contain-layout: same fix as GamesTable.tsx's
          identical wrapper, applied here preemptively for the same
          structural reason (identical overflow-x-auto pattern), even
          though this table didn't measure as leaking at 768px with
          today's content. */}
      <div className="hidden overflow-x-auto rounded-lg border border-nova-hairline contain-layout md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-nova-hairline bg-nova-crypt text-xs uppercase tracking-wider text-nova-smoke">
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
                className={`cursor-pointer border-b border-nova-hairline transition-colors duration-(--duration-fast) ease-standard last:border-b-0 hover:bg-nova-crypt ${
                  selectedId === order.id ? "bg-nova-crypt" : "bg-nova-void"
                }`}
              >
                <td className="px-4 py-3 font-mono text-nova-bone">
                  {order.paymentReference}
                </td>
                <td className="px-4 py-3 text-nova-ash">
                  {customer?.fullName ?? (order.guestPhone ? "Guest" : "—")}
                </td>
                <td className="px-4 py-3 text-nova-ash">
                  {displayPhone(customer?.phoneNumber ?? order.guestPhone)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-nova-bone">
                  {formatPriceExact(order.amountExact)}
                </td>
                <td className="px-4 py-3 text-nova-ash">
                  {method?.label ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 text-right text-nova-smoke">
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
                ? "border-nova-ember bg-nova-crypt"
                : "border-nova-hairline bg-nova-void"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-sm font-semibold text-nova-bone">
                {order.paymentReference}
              </span>
              <StatusBadge status={order.status} />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-nova-bone">
                  {customer?.fullName ?? (order.guestPhone ? "Guest" : "—")}
                </p>
                <p className="truncate text-xs text-nova-smoke">
                  {displayPhone(customer?.phoneNumber ?? order.guestPhone)} · {method?.label ?? "—"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-nova-bone">
                  {formatPriceExact(order.amountExact)}
                </p>
                <p className="text-xs text-nova-smoke">
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
