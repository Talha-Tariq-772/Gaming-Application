"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminTable, { type AdminTableColumn } from "@/src/components/admin/AdminTable";
import ProfitLineChart, { type ProfitChartPoint } from "@/src/components/admin/ProfitLineChart";
import StatCard from "@/src/components/admin/StatCard";
import { formatPrice } from "@/src/lib/format";
import type { ProfitByProduct, ProfitGranularity, ProfitPoint } from "@/src/types/database";

const GRANULARITIES: { value: ProfitGranularity; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

/** Bucket timestamps are ISO strings from date_trunc — label them to match
 * the granularity so a monthly chart doesn't read as a run of 1sts. */
function bucketLabel(iso: string, granularity: ProfitGranularity): string {
  const d = new Date(iso);
  if (granularity === "month") {
    return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Takes whole percent (e.g. 66), not a 0-1 fraction — StatCard rounds to
 * integers, so fractional inputs collapse to 0. */
function formatPercent(percent: number): string {
  return `${Math.round(percent)}%`;
}

export default function AdminProfitClient({
  series,
  byProduct,
  granularity,
  days,
}: {
  series: ProfitPoint[];
  byProduct: ProfitByProduct[];
  granularity: ProfitGranularity;
  days: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const chartData: ProfitChartPoint[] = useMemo(
    () =>
      series.map((p) => ({
        label: bucketLabel(p.bucket, granularity),
        revenue: p.revenue,
        cost: p.cost,
        profit: p.profit,
      })),
    [series, granularity],
  );

  const totals = useMemo(() => {
    const revenue = series.reduce((s, p) => s + p.revenue, 0);
    const cost = series.reduce((s, p) => s + p.cost, 0);
    const itemsSold = series.reduce((s, p) => s + p.itemsSold, 0);
    const itemsMissingCost = series.reduce((s, p) => s + p.itemsMissingCost, 0);
    const profit = revenue - cost;
    return {
      revenue,
      cost,
      profit,
      itemsSold,
      itemsMissingCost,
      margin: revenue === 0 ? 0 : profit / revenue,
    };
  }, [series]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`/admin/profit?${params.toString()}`);
  }

  const columns: AdminTableColumn<ProfitByProduct>[] = [
    {
      key: "title",
      header: "Product",
      render: (row) => <span className="font-medium text-nova-bone">{row.title}</span>,
    },
    {
      key: "itemsSold",
      header: "Sold",
      align: "right",
      render: (row) => <span className="text-nova-ash">{row.itemsSold}</span>,
    },
    {
      key: "revenue",
      header: "Revenue",
      align: "right",
      render: (row) => <span className="text-nova-ash">{formatPrice(row.revenue)}</span>,
    },
    {
      key: "cost",
      header: "Cost",
      align: "right",
      render: (row) => <span className="text-nova-ash">{formatPrice(row.cost)}</span>,
    },
    {
      key: "profit",
      header: "Profit",
      align: "right",
      render: (row) => (
        <span className={`font-semibold ${row.profit < 0 ? "text-nova-blood" : "text-nova-bone"}`}>
          {formatPrice(row.profit)}
        </span>
      ),
    },
    {
      key: "margin",
      header: "Margin",
      align: "right",
      render: (row) => (
        <span className="text-nova-ash">
          {row.revenue === 0 ? "—" : formatPercent((row.profit / row.revenue) * 100)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-nova-bone">Profit</h1>
          <p className="mt-1 text-sm text-nova-ash">
            Approved orders only, counted on approval date · last {days} days
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {GRANULARITIES.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setParam("granularity", g.value)}
              aria-pressed={granularity === g.value}
              className={`min-h-11 rounded-md border px-3 py-2 text-sm font-semibold ${
                granularity === g.value
                  ? "border-nova-ember bg-nova-ember-bright text-nova-void"
                  : "border-nova-hairline text-nova-ash hover:text-nova-bone"
              }`}
            >
              {g.label}
            </button>
          ))}
          {[30, 90, 365].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setParam("days", String(d))}
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

      {totals.itemsMissingCost > 0 && (
        <div className="rounded-lg border border-nova-gild/40 bg-nova-gild/10 p-4">
          <p className="text-sm font-semibold text-nova-gild">
            {totals.itemsMissingCost} sold item{totals.itemsMissingCost === 1 ? "" : "s"} had no cost
            price recorded at approval
          </p>
          <p className="mt-1 text-xs text-nova-ash">
            Their revenue counts but their cost doesn&rsquo;t, so profit below is an upper bound, not
            an exact figure. Set a cost price on those products to fix it going forward — past
            approvals keep the cost they locked in.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Revenue" value={totals.revenue} format={formatPrice} />
        <StatCard label="Cost" value={totals.cost} format={formatPrice} />
        <StatCard label="Net profit" value={totals.profit} format={formatPrice} />
        {/* Margin is passed as whole PERCENT, not a 0-1 fraction: StatCard
            counts up through Math.round(), so a fraction like 0.66 rounds
            to 0 on every tick and the tile renders a permanent "0%". */}
        <StatCard
          label="Margin"
          value={totals.margin * 100}
          format={(v) => (totals.revenue === 0 ? "—" : formatPercent(v))}
        />
      </div>

      <div className="rounded-lg border border-nova-hairline bg-nova-crypt p-4">
        <h2 className="mb-4 text-sm font-semibold text-nova-bone">
          Revenue, cost and profit over time
        </h2>
        <ProfitLineChart data={chartData} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-nova-bone">Profit by product</h2>
        <AdminTable
          columns={columns}
          rows={byProduct}
          rowKey={(row) => row.gameId}
          emptyMessage="No approved orders in this period."
          renderMobileCard={(row) => (
            <div className="flex flex-col gap-2 rounded-lg border border-nova-hairline bg-nova-void p-4">
              <p className="font-medium text-nova-bone">{row.title}</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-nova-smoke">Sold</dt>
                <dd className="text-right text-nova-ash">{row.itemsSold}</dd>
                <dt className="text-nova-smoke">Revenue</dt>
                <dd className="text-right text-nova-ash">{formatPrice(row.revenue)}</dd>
                <dt className="text-nova-smoke">Cost</dt>
                <dd className="text-right text-nova-ash">{formatPrice(row.cost)}</dd>
                <dt className="text-nova-smoke">Profit</dt>
                <dd className={`text-right font-semibold ${row.profit < 0 ? "text-nova-blood" : "text-nova-bone"}`}>
                  {formatPrice(row.profit)}
                </dd>
              </dl>
            </div>
          )}
        />
      </div>
    </div>
  );
}
