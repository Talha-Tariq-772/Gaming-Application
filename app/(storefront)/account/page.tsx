import { redirect } from "next/navigation";
import Button from "@/components/Button";
import OrderCard from "@/src/components/account/OrderCard";
import { getGamesByIds, getPaymentMethodsByIds } from "@/src/lib/catalog";
import { getGiftCardProductsForCodeIds } from "@/src/lib/gift-card-catalog";
import { getOrdersForUser } from "@/src/lib/order-queries";
import { createClient } from "@/src/lib/supabase/server-session";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Defensive — middleware already redirects unauthenticated /account visits.
  if (!user) redirect("/sign-in?next=/account");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const { orders, orderItems } = await getOrdersForUser(user.id);

  const gameIds = [...new Set(orderItems.map((i) => i.gameId).filter((id): id is string => Boolean(id)))];
  const giftCardCodeIds = [
    ...new Set(orderItems.map((i) => i.giftCardCodeId).filter((id): id is string => Boolean(id))),
  ];
  const paymentMethodIds = [...new Set(orders.map((o) => o.paymentMethodId).filter((id): id is string => Boolean(id)))];
  const [games, giftCardProductsByCodeId, paymentMethods] = await Promise.all([
    getGamesByIds(gameIds),
    getGiftCardProductsForCodeIds(giftCardCodeIds),
    getPaymentMethodsByIds(paymentMethodIds),
  ]);
  const giftCardProductsByCodeIdObj = Object.fromEntries(giftCardProductsByCodeId);

  const myOrders = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <div className="mb-12">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-nova-ember-text">Account</span>
        <h1 className="mt-2 text-display-sm font-display font-extrabold text-nova-bone">My Orders</h1>
        {profile?.full_name && <p className="mt-2 text-sm text-nova-ash">{profile.full_name}</p>}
      </div>

      {myOrders.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-nova-hairline bg-nova-crypt px-6 py-24 text-center">
          <p className="font-display text-xl font-bold text-nova-bone">No orders yet</p>
          <p className="max-w-sm text-sm text-nova-ash">
            Once you check out, your orders will show up here.
          </p>
          <Button as="a" href="/games" variant="secondary">
            Browse Store
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {myOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              items={orderItems.filter((item) => item.orderId === order.id)}
              games={games}
              giftCardProductsByCodeId={giftCardProductsByCodeIdObj}
              paymentMethods={paymentMethods}
            />
          ))}
        </div>
      )}
    </div>
  );
}
