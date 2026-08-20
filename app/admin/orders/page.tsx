import AdminOrdersClient from "@/src/components/admin/AdminOrdersClient";
import { getGamesByIds, getPaymentMethodsByIds } from "@/src/lib/catalog";
import { getOrdersForAdmin, getProfilesByIds } from "@/src/lib/order-queries";

export default async function AdminOrdersPage() {
  const { orders, orderItems } = await getOrdersForAdmin();

  const userIds = [...new Set(orders.map((o) => o.userId))];
  const gameIds = [...new Set(orderItems.map((i) => i.gameId))];
  const paymentMethodIds = [...new Set(orders.map((o) => o.paymentMethodId).filter((id): id is string => Boolean(id)))];

  const [customers, games, paymentMethods] = await Promise.all([
    getProfilesByIds(userIds),
    getGamesByIds(gameIds),
    getPaymentMethodsByIds(paymentMethodIds),
  ]);

  return (
    <AdminOrdersClient
      orders={orders}
      orderItems={orderItems}
      customers={customers}
      games={games}
      paymentMethods={paymentMethods}
    />
  );
}
