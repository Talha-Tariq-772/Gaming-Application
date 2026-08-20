import AdminDashboardClient from "@/src/components/admin/AdminDashboardClient";
import { getGamesByIds, getPaymentMethodsByIds } from "@/src/lib/catalog";
import { getOrdersForAdmin, getProfilesByIds } from "@/src/lib/order-queries";

export default async function AdminDashboardPage() {
  const { orders, orderItems } = await getOrdersForAdmin({ status: "under_review" });
  const queueOrders = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const userIds = [...new Set(orders.map((o) => o.userId))];
  const gameIds = [...new Set(orderItems.map((i) => i.gameId))];
  const paymentMethodIds = [
    ...new Set(orders.map((o) => o.paymentMethodId).filter((id): id is string => Boolean(id))),
  ];

  const [customers, games, paymentMethods] = await Promise.all([
    getProfilesByIds(userIds),
    getGamesByIds(gameIds),
    getPaymentMethodsByIds(paymentMethodIds),
  ]);

  return (
    <AdminDashboardClient
      queueOrders={queueOrders}
      queueOrderItems={orderItems}
      customers={customers}
      games={games}
      paymentMethods={paymentMethods}
    />
  );
}
