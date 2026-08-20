import type {
  Game,
  GameCredentialStock,
  Order,
  OrderItem,
} from "@/src/types/database";

/**
 * Revenue is recognized on `reviewedAt` (the moment an admin approves an
 * order) rather than `createdAt` — an order that was only ever initiated
 * isn't revenue, and approval is the point the sale is actually confirmed.
 */
function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function daysAgoStart(daysAgo: number): number {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getRevenueSince(orders: Order[], sinceMs: number): number {
  return orders
    .filter(
      (o) =>
        o.status === "approved" &&
        o.reviewedAt &&
        new Date(o.reviewedAt).getTime() >= sinceMs,
    )
    .reduce((sum, o) => sum + o.amountExact, 0);
}

export function getRevenueToday(orders: Order[]): number {
  return getRevenueSince(orders, startOfToday());
}

export function getRevenueThisWeek(orders: Order[]): number {
  return getRevenueSince(orders, daysAgoStart(6));
}

export function getRevenueThisMonth(orders: Order[]): number {
  return getRevenueSince(orders, daysAgoStart(29));
}

export interface DailyRevenuePoint {
  date: string;
  label: string;
  revenue: number;
}

export function getDailyRevenueSeries(
  orders: Order[],
  days = 30,
): DailyRevenuePoint[] {
  const points: DailyRevenuePoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEndMs = dayStart.getTime() + 24 * 60 * 60 * 1000;

    const revenue = orders
      .filter((o) => o.status === "approved" && o.reviewedAt)
      .filter((o) => {
        const t = new Date(o.reviewedAt as string).getTime();
        return t >= dayStart.getTime() && t < dayEndMs;
      })
      .reduce((sum, o) => sum + o.amountExact, 0);

    points.push({
      date: dayStart.toISOString(),
      label: dayStart.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      }),
      revenue,
    });
  }

  return points;
}

export interface TopSellingGame {
  game: Game;
  unitsSold: number;
  revenue: number;
}

export function getTopSellingGames(
  orders: Order[],
  orderItems: OrderItem[],
  games: Game[],
  limit = 6,
): TopSellingGame[] {
  const approvedOrderIds = new Set(
    orders.filter((o) => o.status === "approved").map((o) => o.id),
  );
  const stats = new Map<string, { units: number; revenue: number }>();

  for (const item of orderItems) {
    if (!approvedOrderIds.has(item.orderId)) continue;
    const entry = stats.get(item.gameId) ?? { units: 0, revenue: 0 };
    entry.units += 1;
    entry.revenue += item.price;
    stats.set(item.gameId, entry);
  }

  return Array.from(stats.entries())
    .map(([gameId, entry]): TopSellingGame | null => {
      const game = games.find((g) => g.id === gameId);
      return game
        ? { game, unitsSold: entry.units, revenue: entry.revenue }
        : null;
    })
    .filter((x): x is TopSellingGame => x !== null)
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, limit);
}

/** Oldest-first — the longest-waiting order should be served first. */
export function getOrderAgeLabel(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export interface LowStockGame {
  game: Game;
  available: number;
}

export function getLowStockGames(
  stock: GameCredentialStock[],
  games: Game[],
  threshold: number,
): LowStockGame[] {
  return stock
    .filter((s) => s.available <= threshold)
    .map((s): LowStockGame | null => {
      const game = games.find((g) => g.id === s.gameId);
      return game ? { game, available: s.available } : null;
    })
    .filter((x): x is LowStockGame => x !== null)
    .sort((a, b) => a.available - b.available);
}
