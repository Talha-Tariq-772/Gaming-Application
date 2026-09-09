import type {
  Game,
  GameCredentialStock,
  Order,
  OrderStatus,
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

export interface OrderStatusCount {
  status: OrderStatus;
  count: number;
}

/** Same status order the orders-page filter pills use, so the dashboard's
 * status breakdown and the filter list read the same way. */
const STATUS_ORDER: OrderStatus[] = [
  "under_review",
  "payment_claimed",
  "awaiting_payment",
  "approved",
  "rejected",
  "expired",
];

export function getOrderStatusCounts(orders: Order[]): OrderStatusCount[] {
  const counts = new Map<OrderStatus, number>();
  for (const status of STATUS_ORDER) counts.set(status, 0);
  for (const order of orders) counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
  return STATUS_ORDER.map((status) => ({ status, count: counts.get(status) ?? 0 }));
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
