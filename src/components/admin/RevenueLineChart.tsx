"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPrice } from "@/src/lib/format";
import type { DailyRevenuePoint } from "@/src/lib/admin-stats";

// Hardcoded to match app/globals.css tokens — Recharts renders plain SVG
// attributes, so CSS custom properties aren't a reliable fit here. Was teal
// (#00e6d8), the pre-nova accent — the Session 6 rename only touched
// Tailwind classes, missing these hardcoded chart props.
const ACCENT = "#c1440e";
const GRID = "#2a2124";
const MUTED = "#8d857c";

export default function RevenueLineChart({ data }: { data: DailyRevenuePoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke={MUTED}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            interval={4}
          />
          <YAxis
            stroke={MUTED}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
            }
          />
          <Tooltip
            contentStyle={{
              background: "#1c1c21",
              border: "1px solid #2f2f36",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#f5f5f7" }}
            formatter={(value) => [formatPrice(Number(value)), "Revenue"]}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke={ACCENT}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
