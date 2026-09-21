import AdminPaymentsClient from "@/src/components/admin/AdminPaymentsClient";
import { getRevenueByPaymentMethod } from "@/src/lib/payment-revenue";

const ALLOWED_DAYS = [30, 90, 365];

/** Anything outside the offered options falls back to 30 — same guard as
 * /admin/profit, and for the same reason: the value reaches SQL as a date
 * bound, so it is never taken on trust from the URL. */
function parseDays(value: string | undefined): number {
  const parsed = Number(value);
  return ALLOWED_DAYS.includes(parsed) ? parsed : 30;
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const days = parseDays(params.days);

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);

  const rows = await getRevenueByPaymentMethod({ from, to });

  return <AdminPaymentsClient rows={rows} days={days} />;
}
