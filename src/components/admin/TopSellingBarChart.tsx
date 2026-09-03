"use client";

"use client";

import { useTheme } from "next-themes";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TopSellingGame } from "@/src/lib/admin-stats";

// Matches app/globals.css's --color-nova-ember/-hairline/-smoke — Recharts
// renders plain SVG attributes, so CSS custom properties aren't a reliable
// fit here. Was teal (#00e6d8), the pre-nova accent — the Session 6 rename
// only touched Tailwind classes, missing these hardcoded chart props.
// Theme session: split into DARK/LIGHT — see RevenueLineChart.tsx's
// matching comment, same reasoning applies here.
const DARK = { accent: "#c1440e", grid: "#7e6954", muted: "#8d857c", tooltipBg: "#141013", tooltipBorder: "#7e6954", tooltipText: "#e8dfd0" };
const LIGHT = { accent: "#a83c0a", grid: "#7d634a", muted: "#605040", tooltipBg: "#e4dac6", tooltipBorder: "#7d634a", tooltipText: "#29241f" };

export default function TopSellingBarChart({ data }: { data: TopSellingGame[] }) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === "light" ? LIGHT : DARK;

  const chartData = data.map((d) => ({
    title: d.game.title,
    units: d.unitsSold,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 w-full items-center justify-center text-sm text-nova-ash">
        No sales yet — approved orders will show up here.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke={c.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            stroke={c.muted}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: c.grid }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="title"
            stroke={c.muted}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip
            contentStyle={{
              background: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: c.tooltipText }}
            formatter={(value) => [Number(value), "Units sold"]}
          />
          <Bar dataKey="units" fill={c.accent} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
