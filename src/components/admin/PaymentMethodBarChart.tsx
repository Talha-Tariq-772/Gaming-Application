"use client";

import { useTheme } from "next-themes";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPrice } from "@/src/lib/format";

// Same hardcoded token pairs as ProfitLineChart and RevenueLineChart —
// Recharts renders plain SVG attributes, so CSS custom properties aren't a
// reliable fit. `accent` is the ember used for every other admin chart's
// primary series; `muted` doubles as the bar fill for the "Not recorded"
// row, which is an absence of data rather than a payment channel and
// shouldn't read with the same weight as the real ones.
const DARK = {
  accent: "#c1440e",
  unrecorded: "#7e6954",
  grid: "#7e6954",
  muted: "#8d857c",
  tooltipBg: "#141013",
  tooltipBorder: "#7e6954",
  tooltipText: "#e8dfd0",
};
const LIGHT = {
  accent: "#a83c0a",
  unrecorded: "#7d634a",
  grid: "#7d634a",
  muted: "#605040",
  tooltipBg: "#e4dac6",
  tooltipBorder: "#7d634a",
  tooltipText: "#29241f",
};

export interface PaymentMethodChartBar {
  label: string;
  revenue: number;
  /** Dims the bar — set for the catch-all row, which is a gap in the
   * records rather than a channel money actually came through. */
  isUnrecorded: boolean;
}

/** Bars run horizontally (layout="vertical") because the categories are
 * payment-method labels — "Bank Transfer (Faysal Bank)" has nowhere to go
 * on a vertical chart's x-axis except rotated or truncated. */
export default function PaymentMethodBarChart({ data }: { data: PaymentMethodChartBar[] }) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === "light" ? LIGHT : DARK;

  if (data.length === 0) {
    return (
      <p className="flex h-64 items-center justify-center text-sm text-nova-ash">
        No approved orders in this period.
      </p>
    );
  }

  // Grows with the number of methods instead of a fixed h-64: four bars in
  // a 256px box are fine, but ten would be slivers. The 256px floor keeps
  // a one- or two-method period from collapsing into a stub of a chart —
  // maxBarSize below, not this floor, is what stops that spare height from
  // being spent on one absurdly thick bar.
  const height = Math.max(256, data.length * 56 + 32);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
        >
          <CartesianGrid stroke={c.grid} strokeDasharray="3 3" horizontal={false} opacity={0.3} />
          <XAxis
            type="number"
            tick={{ fill: c.muted, fontSize: 11 }}
            stroke={c.grid}
            tickFormatter={(v) => formatPrice(Number(v ?? 0))}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: c.muted, fontSize: 11 }}
            stroke={c.grid}
            width={150}
          />
          <Tooltip
            cursor={{ fill: c.grid, opacity: 0.15 }}
            formatter={(value) => [formatPrice(Number(value ?? 0)), "Revenue"]}
            contentStyle={{
              backgroundColor: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: 8,
              color: c.tooltipText,
              fontSize: 12,
            }}
            labelStyle={{ color: c.tooltipText }}
          />
          {/* Without maxBarSize, Recharts divides the plot height evenly
              across however few categories there are — a single payment
              method in the period renders as one ~170px slab of colour
              that reads as a filled panel rather than a bar. */}
          <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]} maxBarSize={44}>
            {data.map((row) => (
              <Cell key={row.label} fill={row.isUnrecorded ? c.unrecorded : c.accent} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
