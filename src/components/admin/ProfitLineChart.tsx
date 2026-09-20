"use client";

import { useTheme } from "next-themes";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPrice } from "@/src/lib/format";

// Same hardcoded token pairs as RevenueLineChart — Recharts renders plain
// SVG attributes, so CSS custom properties aren't a reliable fit. `profit`
// gets the ember accent (the figure that matters); revenue and cost are
// deliberately quieter so the profit line reads first.
const DARK = {
  profit: "#c1440e",
  revenue: "#8d857c",
  cost: "#7e6954",
  grid: "#7e6954",
  muted: "#8d857c",
  tooltipBg: "#141013",
  tooltipBorder: "#7e6954",
  tooltipText: "#e8dfd0",
};
const LIGHT = {
  profit: "#a83c0a",
  revenue: "#605040",
  cost: "#7d634a",
  grid: "#7d634a",
  muted: "#605040",
  tooltipBg: "#e4dac6",
  tooltipBorder: "#7d634a",
  tooltipText: "#29241f",
};

export interface ProfitChartPoint {
  label: string;
  revenue: number;
  cost: number;
  profit: number;
}

export default function ProfitLineChart({ data }: { data: ProfitChartPoint[] }) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === "light" ? LIGHT : DARK;

  if (data.length === 0) {
    return (
      <p className="flex h-64 items-center justify-center text-sm text-nova-ash">
        No approved orders in this period.
      </p>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} opacity={0.3} />
          <XAxis dataKey="label" tick={{ fill: c.muted, fontSize: 11 }} stroke={c.grid} />
          <YAxis
            tick={{ fill: c.muted, fontSize: 11 }}
            stroke={c.grid}
            width={70}
            tickFormatter={(v) => formatPrice(Number(v ?? 0))}
          />
          <Tooltip
            formatter={(value, name) => [formatPrice(Number(value ?? 0)), String(name ?? "")]}
            contentStyle={{
              backgroundColor: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: 8,
              color: c.tooltipText,
              fontSize: 12,
            }}
            labelStyle={{ color: c.tooltipText }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: c.muted }} />
          <Line type="monotone" dataKey="revenue" name="Revenue" stroke={c.revenue} strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="cost" name="Cost" stroke={c.cost} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          <Line type="monotone" dataKey="profit" name="Profit" stroke={c.profit} strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
