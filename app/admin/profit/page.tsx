import AdminProfitClient from "@/src/components/admin/AdminProfitClient";
import { getProfitByProduct, getProfitSeries } from "@/src/lib/cost-price";
import type { ProfitGranularity } from "@/src/types/database";

const ALLOWED_DAYS = [30, 90, 365];

function parseGranularity(value: string | undefined): ProfitGranularity {
  return value === "week" || value === "month" ? value : "day";
}

/** Anything outside the offered options falls back to 30 — the value
 * reaches SQL as an interval, so it is never taken on trust from the URL. */
function parseDays(value: string | undefined): number {
  const parsed = Number(value);
  return ALLOWED_DAYS.includes(parsed) ? parsed : 30;
}

export default async function AdminProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ granularity?: string; days?: string }>;
}) {
  const params = await searchParams;
  const granularity = parseGranularity(params.granularity);
  const days = parseDays(params.days);

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);

  const [series, byProduct] = await Promise.all([
    getProfitSeries(granularity, { from, to }),
    getProfitByProduct({ from, to }),
  ]);

  return (
    <AdminProfitClient
      series={series}
      byProduct={byProduct}
      granularity={granularity}
      days={days}
    />
  );
}
