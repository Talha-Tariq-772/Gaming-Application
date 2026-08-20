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

const ACCENT = "#00e6d8";
const GRID = "#2f2f36";
const MUTED = "#8b8b95";

export default function TopSellingBarChart({ data }: { data: TopSellingGame[] }) {
  const chartData = data.map((d) => ({
    title: d.game.title,
    units: d.unitsSold,
  }));

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
