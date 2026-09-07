import AdminDashboardClient from "@/src/components/admin/AdminDashboardClient";
import { getGamesForAdmin, getCredentialStock } from "@/src/lib/admin-queries";
import { getGamesByIds, getPaymentMethodsByIds } from "@/src/lib/catalog";
import { getOrdersForAdmin, getProfilesByIds, getProfilesForAdmin } from "@/src/lib/order-queries";

export default async function AdminDashboardPage() {
  const { orders: queueOrdersRaw, orderItems: queueOrderItems } = await getOrdersForAdmin({
    status: "under_review",
  });
  const queueOrders = [...queueOrdersRaw].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const userIds = [...new Set(queueOrders.map((o) => o.userId).filter((id): id is string => Boolean(id)))];
  const gameIds = [...new Set(queueOrderItems.map((i) => i.gameId))];
  const paymentMethodIds = [
    ...new Set(queueOrders.map((o) => o.paymentMethodId).filter((id): id is string => Boolean(id))),
  ];

  const [
    customers,
    queueGames,
    paymentMethods,
    { orders: allOrders, orderItems: allOrderItems },
    allGames,
    credentialStock,
    allProfiles,
  ] = await Promise.all([
    getProfilesByIds(userIds),
    getGamesByIds(gameIds),
    getPaymentMethodsByIds(paymentMethodIds),
    getOrdersForAdmin(),
    getGamesForAdmin(),
    getCredentialStock(),
    getProfilesForAdmin(),
  ]);

  return (
    <AdminDashboardClient
      queueOrders={queueOrders}
      queueOrderItems={queueOrderItems}
      customers={customers}
      games={queueGames}
      paymentMethods={paymentMethods}
      allOrders={allOrders}
      allOrderItems={allOrderItems}
      allGames={allGames}
      credentialStock={credentialStock}
      totalCustomers={allProfiles.length}
    />
  );
}
