import Link from "next/link";
import type { Order, PaymentMethod, Profile } from "@/src/types/database";
import OrdersTable from "./OrdersTable";

export default function PendingQueueHero({
  orders,
  customers,
  paymentMethods,
  onSelect,
}: {
  orders: Order[];
  customers: Profile[];
  paymentMethods: PaymentMethod[];
  onSelect: (id: string) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-accent">
            Pending Verification
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Oldest first — this is where you spend your time.
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="-my-2.5 flex min-h-11 items-center py-2.5 text-xs font-semibold text-accent hover:text-accent-strong"
        >
          View all →
        </Link>
      </div>
      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-success/30 bg-success-dim px-4 py-12 text-center">
          <p className="text-sm font-semibold text-success">
            You&rsquo;re all caught up
          </p>
          <p className="text-xs text-text-muted">
            Nothing is waiting on verification right now.
          </p>
        </div>
      ) : (
        <OrdersTable
          orders={orders.slice(0, 8)}
          customers={customers}
          paymentMethods={paymentMethods}
          onSelect={onSelect}
          selectedId={null}
        />
      )}
    </section>
  );
}
