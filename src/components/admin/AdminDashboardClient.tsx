"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import SectionErrorBoundary from "@/src/components/SectionErrorBoundary";
import OrderDetailPanel from "@/src/components/admin/OrderDetailPanel";
import OrdersTable from "@/src/components/admin/OrdersTable";
import PendingQueueHero from "@/src/components/admin/PendingQueueHero";
import StatCard from "@/src/components/admin/StatCard";
import StatusBadge from "@/src/components/account/StatusBadge";

// recharts is a large, chart-only dependency (~400KB of the admin bundle)
// that was previously loaded eagerly for every /admin visit even before
// the chart itself was visible below the fold. Dynamic-imported with
// ssr:false (recharts needs the DOM) so it code-splits into its own chunk
// fetched after the rest of the dashboard renders — a fixed-height
// skeleton matching the real chart's h-64 wrapper avoids layout shift.
const ChartSkeleton = () => (
  <div className="h-64 w-full animate-pulse rounded-md bg-nova-slab" />
);
const RevenueLineChart = dynamic(
  () => import("@/src/components/admin/RevenueLineChart"),
  { ssr: false, loading: ChartSkeleton }
);
import {
  getDailyRevenueSeries,
  getLowStockGames,
  getOrderStatusCounts,
  getRevenueThisMonth,
  getRevenueThisWeek,
  getRevenueToday,
} from "@/src/lib/admin-stats";
import type { CredentialStockEntry } from "@/src/lib/admin-queries";
import { formatPrice } from "@/src/lib/format";
import { LOW_STOCK_THRESHOLD } from "@/src/lib/mock-data";
import type { Game, GiftCardProduct, Order, OrderItem, PaymentMethod, Profile } from "@/src/types/database";

const RECENT_ACTIVITY_COUNT = 10;

/**
 * queueOrders backs the pending-review queue (see
 * app/admin/page.tsx). allOrders/allOrderItems/allGames/credentialStock/
 * totalCustomers back every stat card, the status breakdown, the recent-
 * activity list, and the chart below — all real, fetched server-side, no
 * mock data anywhere in this component. customers/games cover every order
 * (not just the queue), so both the queue and recent-activity panels can
 * resolve names for whichever order gets selected. "Pending review" uses
 * the real queue's own count rather than re-deriving it from allOrders,
 * since showing a different count than the queue actually lists right
 * below it would be an obvious inconsistency for zero benefit.
 */
export default function AdminDashboardClient({
  queueOrders,
  customers,
  games,
  giftCardProductsByCodeId,
  paymentMethods,
  allOrders,
  allOrderItems,
  allGames,
  credentialStock,
  totalCustomers,
}: {
  queueOrders: Order[];
  customers: Profile[];
  games: Game[];
  giftCardProductsByCodeId: Record<string, GiftCardProduct>;
  paymentMethods: PaymentMethod[];
  allOrders: Order[];
  allOrderItems: OrderItem[];
  allGames: Game[];
  credentialStock: CredentialStockEntry[];
  totalCustomers: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Part E: opening/closing OrderDetailPanel (selectedId) re-renders this
  // component but changes none of allOrders/allOrderItems/allGames/
  // credentialStock — without this memo, every click redid
  // getDailyRevenueSeries' 30-day loop and getOrderStatusCounts' pass for
  // no reason. Confirmed via code reading (selectedId and this
  // computation share no data), not speculative: these are the same four
  // props on every render except when the server actually re-fetches.
  const stats = useMemo(
    () => ({
      revenueToday: getRevenueToday(allOrders),
      revenueWeek: getRevenueThisWeek(allOrders),
      revenueMonth: getRevenueThisMonth(allOrders),
      lowStock: getLowStockGames(credentialStock, allGames, LOW_STOCK_THRESHOLD),
      dailyRevenue: getDailyRevenueSeries(allOrders, 30),
      statusCounts: getOrderStatusCounts(allOrders),
    }),
    [allOrders, credentialStock, allGames],
  );

  const recentOrders = useMemo(
    () =>
      [...allOrders]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, RECENT_ACTIVITY_COUNT),
    [allOrders],
  );

  // Selection can come from either the pending queue or the recent-
  // activity list below, which together can reference any order — look
  // up against allOrders/allOrderItems (a strict superset of the queue's
  // own set) rather than the queue alone.
  const selectedOrder = allOrders.find((o) => o.id === selectedId) ?? null;
  const selectedItems = selectedOrder
    ? allOrderItems.filter((i) => i.orderId === selectedOrder.id)
    : [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 id="orders-queue-heading" tabIndex={-1} className="font-display text-xl font-bold text-nova-bone">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-nova-ash">
          Overview and the pending verification queue.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Revenue today" value={stats.revenueToday} format={formatPrice} />
        <StatCard label="Revenue this week" value={stats.revenueWeek} format={formatPrice} />
        <StatCard label="Revenue this month" value={stats.revenueMonth} format={formatPrice} />
        <StatCard label="Pending review" value={queueOrders.length} />
        <StatCard label="Low-stock games" value={stats.lowStock.length} />
        <StatCard label="Total customers" value={totalCustomers} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-nova-bone">Orders by status</h2>
        <div className="flex flex-wrap gap-2">
          {stats.statusCounts.map(({ status, count }) => (
            <div
              key={status}
              className="flex items-center gap-2 rounded-lg border border-nova-hairline bg-nova-crypt px-3 py-2"
            >
              <StatusBadge status={status} />
              <span className="text-sm font-semibold text-nova-bone">{count}</span>
            </div>
          ))}
        </div>
      </section>

      <PendingQueueHero
        orders={queueOrders}
        customers={customers}
        paymentMethods={paymentMethods}
        onSelect={setSelectedId}
      />

      <div className="rounded-lg border border-nova-hairline bg-nova-crypt p-4">
        <h2 className="mb-4 text-sm font-semibold text-nova-bone">
          Revenue — last 30 days
        </h2>
        <SectionErrorBoundary label="the revenue chart">
          <RevenueLineChart data={stats.dailyRevenue} />
        </SectionErrorBoundary>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-nova-bone">Recent activity</h2>
          <Link
            href="/admin/orders"
            className="-my-2.5 flex min-h-11 items-center py-2.5 text-xs font-semibold text-nova-ember-text hover:text-nova-ember-lo"
          >
            View all →
          </Link>
        </div>
        <OrdersTable
          orders={recentOrders}
          customers={customers}
          paymentMethods={paymentMethods}
          onSelect={setSelectedId}
          selectedId={null}
        />
      </section>

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
