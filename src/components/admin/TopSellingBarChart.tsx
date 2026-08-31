"use client";

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
const ACCENT = "#c1440e";
const GRID = "#2a2124";
const MUTED = "#8d857c";

export default function TopSellingBarChart({ data }: { data: TopSellingGame[] }) {
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
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            stroke={MUTED}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="title"
            stroke={MUTED}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip
            contentStyle={{
              background: "#1c1c21",
              border: "1px solid #2f2f36",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#f5f5f7" }}
            formatter={(value) => [Number(value), "Units sold"]}
          />
          <Bar dataKey="units" fill={ACCENT} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
