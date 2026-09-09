import AdminTable, { type AdminTableColumn } from "@/src/components/admin/AdminTable";
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

interface Row {
  order: Order;
  customer: Profile | undefined;
  method: PaymentMethod | undefined;
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
  const rows: Row[] = orders.map((order) => ({
    order,
    customer: customers.find((p) => p.id === order.userId),
    method: paymentMethods.find((m) => m.id === order.paymentMethodId),
  }));

  const columns: AdminTableColumn<Row>[] = [
    { key: "reference", header: "Reference", mono: true, render: ({ order }) => <span className="text-nova-bone">{order.paymentReference}</span> },
    {
      key: "customer",
      header: "Customer",
      render: ({ order, customer }) => (
        <span className="text-nova-ash">{customer?.fullName ?? (order.guestPhone ? "Guest" : "—")}</span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: ({ order, customer }) => (
        <span className="text-nova-ash">{displayPhone(customer?.phoneNumber ?? order.guestPhone)}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: ({ order }) => <span className="font-semibold text-nova-bone">{formatPriceExact(order.amountExact)}</span>,
    },
    { key: "method", header: "Method", render: ({ method }) => <span className="text-nova-ash">{method?.label ?? "—"}</span> },
    { key: "status", header: "Status", render: ({ order }) => <StatusBadge status={order.status} /> },
    {
      key: "age",
      header: "Age",
      align: "right",
      render: ({ order }) => <span className="text-nova-smoke">{getOrderAgeLabel(order.createdAt)}</span>,
    },
  ];

  return (
    <AdminTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.order.id}
      onRowClick={(r) => onSelect(r.order.id)}
      isRowSelected={(r) => selectedId === r.order.id}
      rowAriaLabel={(r) => `View order ${r.order.paymentReference}`}
      emptyMessage="No orders match this filter."
      renderMobileCard={({ order, customer, method }) => (
        <button
          type="button"
          onClick={() => onSelect(order.id)}
          className={`flex w-full flex-col gap-3 rounded-lg border p-4 text-left transition-colors duration-(--duration-fast) ease-standard ${
            selectedId === order.id ? "border-nova-ember bg-nova-crypt" : "border-nova-hairline bg-nova-void"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="font-mono text-sm font-semibold text-nova-bone">{order.paymentReference}</span>
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
              <p className="text-sm font-semibold text-nova-bone">{formatPriceExact(order.amountExact)}</p>
              <p className="text-xs text-nova-smoke">{getOrderAgeLabel(order.createdAt)}</p>
            </div>
          </div>
        </button>
      )}
    />
  );
}
