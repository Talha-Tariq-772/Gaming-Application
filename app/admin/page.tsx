import AdminDashboardClient from "@/src/components/admin/AdminDashboardClient";
import { getGamesForAdmin, getCredentialStock } from "@/src/lib/admin-queries";
import { getGamesByIds, getPaymentMethodsByIds } from "@/src/lib/catalog";
import { getGiftCardProductsForCodeIds } from "@/src/lib/gift-card-catalog";
import { getHardwareProductsByIds } from "@/src/lib/hardware-catalog";
import { getOrdersForAdmin, getProfilesByIds, getProfilesForAdmin } from "@/src/lib/order-queries";

export default async function AdminDashboardPage() {
  const { orders: queueOrdersRaw } = await getOrdersForAdmin({
    status: "under_review",
  });
  const queueOrders = [...queueOrdersRaw].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const { orders: allOrders, orderItems: allOrderItems } = await getOrdersForAdmin();

  // Drawn from allOrders/allOrderItems, not just the pending queue — the
  // dashboard's recent-activity list (last 10 orders regardless of
  // status) needs customer/game names to resolve for orders outside the
  // queue too, not just the ones under review.
  const userIds = [...new Set(allOrders.map((o) => o.userId).filter((id): id is string => Boolean(id)))];
  const gameIds = [...new Set(allOrderItems.map((i) => i.gameId).filter((id): id is string => Boolean(id)))];
  const giftCardCodeIds = [
    ...new Set(allOrderItems.map((i) => i.giftCardCodeId).filter((id): id is string => Boolean(id))),
  ];
  const paymentMethodIds = [
    ...new Set(allOrders.map((o) => o.paymentMethodId).filter((id): id is string => Boolean(id))),
  ];

  const hardwareIds = [
    ...new Set(allOrderItems.map((i) => i.hardwareProductId).filter((id): id is string => Boolean(id))),
  ];

  const [customers, queueGames, giftCardProductsByCodeId, hardware, paymentMethods, allGames, credentialStock, allProfiles] =
    await Promise.all([
      getProfilesByIds(userIds),
      getGamesByIds(gameIds),
      getGiftCardProductsForCodeIds(giftCardCodeIds),
      getHardwareProductsByIds(hardwareIds),
      getPaymentMethodsByIds(paymentMethodIds),
      getGamesForAdmin(),
      getCredentialStock(),
      getProfilesForAdmin(),
    ]);

  return (
    <AdminDashboardClient
      queueOrders={queueOrders}
      customers={customers}
      games={queueGames}
      giftCardProductsByCodeId={Object.fromEntries(giftCardProductsByCodeId)}
      hardwareById={Object.fromEntries(hardware.map((h) => [h.id, h]))}
      paymentMethods={paymentMethods}
      allOrders={allOrders}
      allOrderItems={allOrderItems}
      allGames={allGames}
      credentialStock={credentialStock}
      totalCustomers={allProfiles.length}
    />
  );
}
