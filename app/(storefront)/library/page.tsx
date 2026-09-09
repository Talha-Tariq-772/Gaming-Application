import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Button from "@/components/Button";
import LibraryCard from "@/src/components/library/LibraryCard";
import { getGamesByIds } from "@/src/lib/catalog";
import { getOrdersForUser } from "@/src/lib/order-queries";
import { createClient } from "@/src/lib/supabase/server-session";
import type { Game } from "@/src/types/database";

export const metadata: Metadata = {
  title: "Library",
  robots: { index: false, follow: false },
};

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Defensive — middleware already redirects unauthenticated /library visits.
  if (!user) redirect("/sign-in?next=/library");

  // Inherently per-user: getOrdersForUser relies entirely on RLS
  // (auth.uid()-scoped), same guarantee as /account — no extra
  // access-control code needed here.
  const { orders, orderItems } = await getOrdersForUser(user.id);
  const approvedOrders = orders.filter((o) => o.status === "approved");

  // Most-recently-approved order wins if the same game somehow got bought
  // twice — an edge case, not a real flow, but keeps the link target
  // deterministic rather than picking whichever array order happened to win.
  const sortedApprovedOrders = [...approvedOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const orderIdByGameId = new Map<string, string>();
  for (const order of sortedApprovedOrders) {
    for (const item of orderItems) {
      if (item.orderId !== order.id) continue;
      if (!item.gameId) continue; // gift-card item — no library entry, nothing to reveal
      if (!orderIdByGameId.has(item.gameId)) orderIdByGameId.set(item.gameId, order.id);
    }
  }

  const gameIds = [...orderIdByGameId.keys()];
  const games = await getGamesByIds(gameIds);
  const gameById = new Map(games.map((g) => [g.id, g]));

  const entries = gameIds
    .map((gameId) => ({ game: gameById.get(gameId), orderId: orderIdByGameId.get(gameId)! }))
    .filter((entry): entry is { game: Game; orderId: string } => Boolean(entry.game));

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <div className="mb-12">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-nova-ember-text">Library</span>
        <h1 className="mt-2 text-display-sm font-display font-extrabold text-nova-bone">My Library</h1>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-nova-hairline bg-nova-crypt px-6 py-24 text-center">
          <p className="font-display text-xl font-bold text-nova-bone">No purchases yet</p>
          <p className="max-w-sm text-sm text-nova-ash">
            Games you&rsquo;ve bought and had approved will show up here.
          </p>
          <Button as="a" href="/games" variant="secondary">
            Browse Store
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {entries.map((entry) => (
            <LibraryCard key={entry.game.id} game={entry.game} orderId={entry.orderId} />
          ))}
        </div>
      )}
    </div>
  );
}
