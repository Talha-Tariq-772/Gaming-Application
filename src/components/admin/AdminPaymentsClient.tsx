"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminTable, { type AdminTableColumn } from "@/src/components/admin/AdminTable";
import type { PaymentMethodChartBar } from "@/src/components/admin/PaymentMethodBarChart";
import StatCard from "@/src/components/admin/StatCard";
import { formatPrice } from "@/src/lib/format";
import { revenueShare, sumPaymentRevenue } from "@/src/lib/payment-revenue-math";
import type { PaymentMethodRevenue } from "@/src/types/database";

// Same treatment recharts gets on the dashboard: it's a large, chart-only
// dependency, and the table below is this page's primary content, so the
// chart code-splits into its own chunk rather than blocking first paint.
// The skeleton is deliberately h-64 — the real chart's floor height — so
// a short period causes no layout shift on swap.
const ChartSkeleton = () => <div className="h-64 w-full animate-pulse rounded-md bg-nova-slab" />;
const PaymentMethodBarChart = dynamic(
  () => import("@/src/components/admin/PaymentMethodBarChart"),
  { ssr: false, loading: ChartSkeleton },
);

const DAY_RANGES = [30, 90, 365];

/** Takes whole percent (e.g. 42), not a 0-1 fraction — matching
 * AdminProfitClient's formatter, for the same StatCard rounding reason. */
function formatPercent(percent: number): string {
  return `${Math.round(percent)}%`;
}

export default function AdminPaymentsClient({
  rows,
  days,
}: {
  rows: PaymentMethodRevenue[];
  days: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const totals = useMemo(() => sumPaymentRevenue(rows), [rows]);

  // Methods with no confirmed revenue are dropped from the chart but kept
  // in the table: a zero-length bar is noise, while a table row reading
  // "Rs 0 · 3 awaiting approval" is exactly the signal an admin wants.
  const chartData: PaymentMethodChartBar[] = useMemo(
    () =>
      rows
        .filter((row) => row.revenue > 0)
        .map((row) => ({
          label: row.label,
          revenue: row.revenue,
          isUnrecorded: row.paymentMethodId === null,
        })),
    [rows],
  );

  function setDays(value: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("days", String(value));
    router.push(`/admin/payments?${params.toString()}`);
  }

  const columns: AdminTableColumn<PaymentMethodRevenue>[] = [
    {
      key: "label",
      header: "Payment method",
      render: (row) => (
        <span
          className={
            row.paymentMethodId === null ? "italic text-nova-smoke" : "font-medium text-nova-bone"
          }
        >
          {row.label}
        </span>
      ),
    },
    {
      key: "ordersCount",
      header: "Orders",
      align: "right",
      render: (row) => <span className="text-nova-ash">{row.ordersCount}</span>,
    },
    {
      key: "revenue",
      header: "Revenue",
      align: "right",
      render: (row) => (
        <span className="font-semibold text-nova-bone">{formatPrice(row.revenue)}</span>
      ),
    },
    {
      key: "share",
      header: "Share",
      align: "right",
      render: (row) => (
        <span className="text-nova-ash">
          {totals.revenue === 0
            ? "—"
            : formatPercent(revenueShare(row.revenue, totals.revenue) * 100)}
        </span>
      ),
    },
    {
      key: "pending",
      header: "Awaiting approval",
      align: "right",
      render: (row) => (
        <span className={row.pendingOrders > 0 ? "text-nova-gild" : "text-nova-smoke"}>
          {row.pendingOrders === 0
            ? "—"
            : `${formatPrice(row.pendingAmount)} · ${row.pendingOrders}`}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-nova-bone">Payments</h1>
          <p className="mt-1 text-sm text-nova-ash">
            Approved orders only, counted on approval date · last {days} days
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {DAY_RANGES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`min-h-11 rounded-md border px-3 py-2 text-sm font-semibold ${
                days === d
                  ? "border-nova-ember bg-nova-ember-bright text-nova-void"
                  : "border-nova-hairline text-nova-ash hover:text-nova-bone"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {totals.pendingOrders > 0 && (
        <div className="rounded-lg border border-nova-gild/40 bg-nova-gild/10 p-4">
          <p className="text-sm font-semibold text-nova-gild">
            {formatPrice(totals.pendingAmount)} across {totals.pendingOrders} order
            {totals.pendingOrders === 1 ? "" : "s"} is not counted below
          </p>
          <p className="mt-1 text-xs text-nova-ash">
            Those orders were created in this period but haven&rsquo;t been approved, so their
            payment isn&rsquo;t confirmed yet. They join the revenue figures on the day they&rsquo;re
            approved. Rejected and expired orders are excluded entirely.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total revenue" value={totals.revenue} format={formatPrice} />
        <StatCard label="Orders" value={totals.ordersCount} />
        <StatCard label="Avg order value" value={totals.averageOrderValue} format={formatPrice} />
        <StatCard label="Awaiting approval" value={totals.pendingAmount} format={formatPrice} />
      </div>

      <div className="rounded-lg border border-nova-hairline bg-nova-crypt p-4">
        <h2 className="mb-4 text-sm font-semibold text-nova-bone">Revenue by payment method</h2>
        <PaymentMethodBarChart data={chartData} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-nova-bone">Breakdown</h2>
        <AdminTable
          columns={columns}
          rows={rows}
          // Null is the "Not recorded" catch-all — the RPC groups every
          // method-less order into one row, so this constant stays unique.
          rowKey={(row) => row.paymentMethodId ?? "unrecorded"}
          emptyMessage="No orders in this period."
          renderMobileCard={(row) => (
            <div className="flex flex-col gap-2 rounded-lg border border-nova-hairline bg-nova-void p-4">
              <p
                className={
                  row.paymentMethodId === null
                    ? "italic text-nova-smoke"
                    : "font-medium text-nova-bone"
                }
              >
                {row.label}
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-nova-smoke">Orders</dt>
                <dd className="text-right text-nova-ash">{row.ordersCount}</dd>
                <dt className="text-nova-smoke">Revenue</dt>
                <dd className="text-right font-semibold text-nova-bone">
                  {formatPrice(row.revenue)}
                </dd>
                <dt className="text-nova-smoke">Share</dt>
                <dd className="text-right text-nova-ash">
                  {totals.revenue === 0
                    ? "—"
                    : formatPercent(revenueShare(row.revenue, totals.revenue) * 100)}
                </dd>
                <dt className="text-nova-smoke">Awaiting approval</dt>
                <dd
                  className={`text-right ${row.pendingOrders > 0 ? "text-nova-gild" : "text-nova-smoke"}`}
                >
                  {row.pendingOrders === 0
                    ? "—"
                    : `${formatPrice(row.pendingAmount)} · ${row.pendingOrders}`}
                </dd>
              </dl>
            </div>
          )}
        />
      </div>

      <p className="text-xs text-nova-smoke">
        Revenue here is the exact amount each customer was asked to transfer, so it runs a few rupees
        above the Profit page&rsquo;s revenue for the same period — that page sums line prices, which
        exclude the per-order reconciliation offset.
      </p>
    </div>
  );
}
