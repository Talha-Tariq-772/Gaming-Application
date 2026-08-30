"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import SectionErrorBoundary from "@/src/components/SectionErrorBoundary";
import OrderDetailPanel from "@/src/components/admin/OrderDetailPanel";
import PendingQueueHero from "@/src/components/admin/PendingQueueHero";
import StatCard from "@/src/components/admin/StatCard";

// recharts is a large, chart-only dependency (~400KB of the admin bundle)
// that was previously loaded eagerly for every /admin visit even before
// the charts themselves were visible below the fold. Dynamic-imported with
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
const TopSellingBarChart = dynamic(
  () => import("@/src/components/admin/TopSellingBarChart"),
  { ssr: false, loading: ChartSkeleton }
);
import {
  getDailyRevenueSeries,
  getLowStockGames,
  getRevenueThisMonth,
  getRevenueThisWeek,
  getRevenueToday,
  getTopSellingGames,
} from "@/src/lib/admin-stats";
import { formatPrice } from "@/src/lib/format";
import { LOW_STOCK_THRESHOLD, MOCK_CREDENTIAL_STOCK, MOCK_GAMES, MOCK_PROFILES } from "@/src/lib/mock-data";
import { useAllOrders } from "@/src/lib/use-all-orders";
import { useHydrated } from "@/src/lib/use-hydrated";
import type { Game, Order, OrderItem, PaymentMethod, Profile } from "@/src/types/database";

/**
 * queueOrders/queueOrderItems/customers/games/paymentMethods are real,
 * fetched server-side (see app/admin/page.tsx) — the pending queue is the
 * operational core of the business and can't run on demo data. Revenue/
 * top-selling/low-stock/total-customers stay on mock data for now (real
 * aggregation queries are a separate task); "Pending review" uses the real
 * queue's own count rather than a stale mock number, since showing a
 * different count than the queue actually lists right below it would be
 * an obvious inconsistency for zero benefit.
 */
export default function AdminDashboardClient({
  queueOrders,
  queueOrderItems,
  customers,
  games,
  paymentMethods,
}: {
  queueOrders: Order[];
  queueOrderItems: OrderItem[];
  customers: Profile[];
  games: Game[];
  paymentMethods: PaymentMethod[];
}) {
  const hydrated = useHydrated();
  const { orders, orderItems } = useAllOrders();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    if (!hydrated) return null;
    return {
      revenueToday: getRevenueToday(orders),
      revenueWeek: getRevenueThisWeek(orders),
      revenueMonth: getRevenueThisMonth(orders),
      lowStock: getLowStockGames(
        MOCK_CREDENTIAL_STOCK,
        MOCK_GAMES,
        LOW_STOCK_THRESHOLD,
      ),
      dailyRevenue: getDailyRevenueSeries(orders, 30),
      topSelling: getTopSellingGames(orders, orderItems, MOCK_GAMES, 6),
    };
  }, [hydrated, orders, orderItems]);

  if (!hydrated || !stats) {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">Loading…</span>
        <div
          aria-hidden="true"
          className="h-64 rounded-lg border border-nova-hairline bg-nova-crypt"
        />
      </div>
    );
  }

  const selectedOrder = queueOrders.find((o) => o.id === selectedId) ?? null;
  const selectedItems = selectedOrder
    ? queueOrderItems.filter((i) => i.orderId === selectedOrder.id)
    : [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 id="orders-queue-heading" tabIndex={-1} className="text-xl font-bold text-nova-bone">
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
        <StatCard label="Total customers" value={MOCK_PROFILES.length} />
      </div>

      <PendingQueueHero
        orders={queueOrders}
        customers={customers}
        paymentMethods={paymentMethods}
        onSelect={setSelectedId}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-nova-hairline bg-nova-crypt p-4">
          <h2 className="mb-4 text-sm font-semibold text-nova-bone">
            Revenue — last 30 days
          </h2>
          <SectionErrorBoundary label="the revenue chart">
            <RevenueLineChart data={stats.dailyRevenue} />
          </SectionErrorBoundary>
        </div>
        <div className="rounded-lg border border-nova-hairline bg-nova-crypt p-4">
          <h2 className="mb-4 text-sm font-semibold text-nova-bone">
            Top-selling games
          </h2>
          <SectionErrorBoundary label="the top-selling chart">
            <TopSellingBarChart data={stats.topSelling} />
          </SectionErrorBoundary>
        </div>
      </div>

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
