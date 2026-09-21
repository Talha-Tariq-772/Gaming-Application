import AdminOrdersClient from "@/src/components/admin/AdminOrdersClient";
import { getGamesByIds, getPaymentMethodsByIds } from "@/src/lib/catalog";
import { getGiftCardProductsForCodeIds } from "@/src/lib/gift-card-catalog";
import { getHardwareProductsByIds } from "@/src/lib/hardware-catalog";
import { getOrdersForAdmin, getProfilesByIds } from "@/src/lib/order-queries";

export default async function AdminOrdersPage() {
  const { orders, orderItems } = await getOrdersForAdmin();

  const userIds = [...new Set(orders.map((o) => o.userId).filter((id): id is string => Boolean(id)))];
  const gameIds = [...new Set(orderItems.map((i) => i.gameId).filter((id): id is string => Boolean(id)))];
  const giftCardCodeIds = [
    ...new Set(orderItems.map((i) => i.giftCardCodeId).filter((id): id is string => Boolean(id))),
  ];
  const paymentMethodIds = [...new Set(orders.map((o) => o.paymentMethodId).filter((id): id is string => Boolean(id)))];

  const hardwareIds = [
    ...new Set(orderItems.map((i) => i.hardwareProductId).filter((id): id is string => Boolean(id))),
  ];

  const [customers, games, giftCardProductsByCodeId, hardware, paymentMethods] = await Promise.all([
    getProfilesByIds(userIds),
    getGamesByIds(gameIds),
    getGiftCardProductsForCodeIds(giftCardCodeIds),
    getHardwareProductsByIds(hardwareIds),
    getPaymentMethodsByIds(paymentMethodIds),
  ]);

  return (
    <AdminOrdersClient
      orders={orders}
      orderItems={orderItems}
      customers={customers}
      games={games}
      giftCardProductsByCodeId={Object.fromEntries(giftCardProductsByCodeId)}
      hardwareById={Object.fromEntries(hardware.map((h) => [h.id, h]))}
      paymentMethods={paymentMethods}
    />
  );
}
