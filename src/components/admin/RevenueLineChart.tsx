"use client";

"use client";

import { useTheme } from "next-themes";
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
// Tailwind classes, missing these hardcoded chart props. Theme session:
// these were still the DARK nova values only — no light variant existed,
// so this chart silently stayed dark-on-dark (unreadable) the first time
// this page ever rendered in light mode. Split into DARK/LIGHT, matching
// the exact hex pairs globals.css now carries for ember/hairline/smoke and
// the light-mode crypt/border tokens used for the tooltip card.
const DARK = { accent: "#c1440e", grid: "#7e6954", muted: "#8d857c", tooltipBg: "#141013", tooltipBorder: "#7e6954", tooltipText: "#e8dfd0" };
const LIGHT = { accent: "#a83c0a", grid: "#7d634a", muted: "#605040", tooltipBg: "#e4dac6", tooltipBorder: "#7d634a", tooltipText: "#29241f" };

export default function RevenueLineChart({ data }: { data: DailyRevenuePoint[] }) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === "light" ? LIGHT : DARK;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke={c.muted}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: c.grid }}
            interval={4}
          />
          <YAxis
            stroke={c.muted}
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
              background: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: c.tooltipText }}
            formatter={(value) => [formatPrice(Number(value)), "Revenue"]}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke={c.accent}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
