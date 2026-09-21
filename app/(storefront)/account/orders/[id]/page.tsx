import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import Button from "@/components/Button";
import CredentialReveal from "@/src/components/account/CredentialReveal";
import GiftCardCodeReveal from "@/src/components/account/GiftCardCodeReveal";
import OrderTimeline from "@/src/components/account/OrderTimeline";
import StatusBadge from "@/src/components/account/StatusBadge";
import TrackedWhatsAppLink from "@/src/components/account/TrackedWhatsAppLink";
import PaymentScreenshotUpload from "@/src/components/checkout/PaymentScreenshotUpload";
import ViewOrderTracker from "@/src/components/account/ViewOrderTracker";
import { getGiftCardImage } from "@/lib/product-image";
import { formatDate } from "@/src/lib/date";
import { formatPrice } from "@/src/lib/format";
import { buildWhatsAppLink } from "@/src/lib/order";
import { getGamesByIds, getPaymentMethodsByIds } from "@/src/lib/catalog";
import { getGiftCardProductsForCodeIds } from "@/src/lib/gift-card-catalog";
import { getHardwareProductsByIds } from "@/src/lib/hardware-catalog";
import { getHardwareImage } from "@/lib/product-image";
import { HARDWARE_CATEGORY_LABELS } from "@/src/types/database";
import { toWhatsAppOrderItems } from "@/src/lib/order-item-display";
import { getOrdersForUser } from "@/src/lib/order-queries";
import { createClient } from "@/src/lib/supabase/server-session";

const ACTIONABLE_STATUSES = new Set(["awaiting_payment", "payment_claimed", "under_review"]);

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/account");

  const { orders, orderItems } = await getOrdersForUser(user.id);
  const order = orders.find((o) => o.id === id);

  if (!order) {
    return (
      <div className="mx-auto flex max-w-page flex-col items-center gap-4 px-4 py-24 text-center md:px-8">
        <h1 className="text-display-sm font-display font-extrabold text-nova-bone">Order not found</h1>
        <p className="max-w-sm text-sm text-nova-ash">
          This order doesn&rsquo;t exist, or isn&rsquo;t associated with the account you&rsquo;re viewing.
        </p>
        <Button as="a" href="/account" variant="secondary">
          Back to My Orders
        </Button>
      </div>
    );
  }

  const items = orderItems.filter((item) => item.orderId === order.id);
  const gameIds = [...new Set(items.map((i) => i.gameId).filter((id): id is string => Boolean(id)))];
  const giftCardCodeIds = [...new Set(items.map((i) => i.giftCardCodeId).filter((id): id is string => Boolean(id)))];
  const hardwareIds = [
    ...new Set(items.map((i) => i.hardwareProductId).filter((id): id is string => Boolean(id))),
  ];
  const [games, giftCardProductsByCodeIdMap, hardware, paymentMethods] = await Promise.all([
    getGamesByIds(gameIds),
    getGiftCardProductsForCodeIds(giftCardCodeIds),
    getHardwareProductsByIds(hardwareIds),
    order.paymentMethodId ? getPaymentMethodsByIds([order.paymentMethodId]) : Promise.resolve([]),
  ]);
  const giftCardProductsByCodeId = Object.fromEntries(giftCardProductsByCodeIdMap);
  const hardwareById = Object.fromEntries(hardware.map((h) => [h.id, h]));
  const method = paymentMethods[0];
  const whatsAppItems = toWhatsAppOrderItems(items, games, giftCardProductsByCodeId, hardwareById);

  // An order can hold games, gift cards, or both — label the reveal
  // section for what is actually in it rather than always saying "Game
  // Credentials".
  // Was `productType !== "gift_card"`, which silently counted a
  // hardware line as a game and promised the buyer a reveal that will
  // never exist. Each family is now matched by name, so adding a fourth
  // cannot quietly fall into the wrong bucket.
  const hasGames = items.some((i) => i.productType === "game");
  const hasGiftCards = items.some((i) => i.productType === "gift_card");
  const hasHardware = items.some((i) => i.productType === "hardware");
  // Deliberately says WHERE the buyer is, not WHAT the product
  // mechanism is — see the site-wide copy rules. A hardware-only order
  // still gets "Delivery" because that is a practical shipping fact the
  // buyer needs, not a description of how the product works.
  const deliverablesHeading =
    hasHardware && !hasGames && !hasGiftCards ? "Delivery" : "Your Items";

  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <ViewOrderTracker orderRef={order.paymentReference} status={order.status} />

      <Link
        href="/account"
        className="-my-2.5 mb-6 flex min-h-11 w-fit items-center gap-2 py-2.5 text-sm font-medium text-nova-ash hover:text-nova-bone"
      >
        ← Back to My Orders
      </Link>

      <div className="mb-12 flex flex-wrap items-start justify-between gap-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-nova-ember-text">Order</span>
          <h1 className="mt-2 font-mono text-4xl font-bold text-nova-bone">{order.paymentReference}</h1>
          <p className="mt-2 text-sm text-nova-ash">Placed {formatDate(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {order.status === "rejected" && (
        <div className="mb-8 flex flex-col gap-4 rounded-lg border border-nova-blood/30 bg-nova-blood/15 px-6 py-4">
          {/* Part A3: text-nova-blood on this blood/15 tint measures 4.04:1
              — below the 4.5:1 text floor. Bone stays legible while the
              tinted border/fill still carries the "rejected" color-coding. */}
          {order.rejectionReason && <p className="text-sm text-nova-bone">{order.rejectionReason}</p>}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {method && (
              <TrackedWhatsAppLink
                href={buildWhatsAppLink(order, whatsAppItems, method.label)}
                context="order-detail"
                orderRef={order.paymentReference}
                className="-my-2.5 flex min-h-11 items-center py-2.5 text-sm font-semibold text-nova-blood underline underline-offset-2 hover:text-nova-blood/80"
              >
                Message us about this order →
              </TrackedWhatsAppLink>
            )}
            <Link
              href="/games"
              className="-my-2.5 flex min-h-11 items-center py-2.5 text-sm font-semibold text-nova-blood underline underline-offset-2 hover:text-nova-blood/80"
            >
              Browse the store to order again →
            </Link>
          </div>
        </div>
      )}

      {/* The payment screenshot is uploaded here now rather than sent
          over WhatsApp. The widget reports its own state — "received,
          awaiting verification" vs. a prompt to upload — and allows a
          replacement while the order is still open, so a buyer who sent
          the wrong image can fix it without contacting anyone. */}
      {ACTIONABLE_STATUSES.has(order.status) && (
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-nova-smoke">
            Payment proof
          </h2>
          <PaymentScreenshotUpload orderId={order.id} />
        </section>
      )}

      <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-10">
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-nova-smoke">Items</h2>
            <div className="flex flex-col gap-4">
              {items.map((item) => {
                if (item.productType === "hardware") {
                  const product = item.hardwareProductId
                    ? hardwareById[item.hardwareProductId]
                    : undefined;
                  if (!product) return null;
                  return (
                    <div key={item.id} className="flex items-center gap-4 rounded-lg border border-nova-hairline bg-nova-crypt p-4">
                      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md border border-nova-hairline bg-nova-slab">
                        <Image
                          src={getHardwareImage(product)}
                          alt={product.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex flex-1 items-center justify-between gap-4">
                        <Link
                          href={`/hardware/${product.slug}`}
                          className="flex min-h-11 items-center text-sm font-semibold text-nova-bone hover:text-nova-ember-text"
                        >
                          {product.name}
                        </Link>
                        <span className="text-sm text-nova-ash">{formatPrice(item.price)}</span>
                      </div>
                    </div>
                  );
                }
                if (item.productType === "gift_card") {
                  const product = item.giftCardCodeId ? giftCardProductsByCodeId[item.giftCardCodeId] : undefined;
                  if (!product) return null;
                  return (
                    <div key={item.id} className="flex items-center gap-4 rounded-lg border border-nova-hairline bg-nova-crypt p-4">
                      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md border border-nova-hairline bg-nova-slab">
                        <Image
                          src={getGiftCardImage(product)}
                          alt={product.title}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex flex-1 items-center justify-between gap-4">
                        <Link
                          href={`/gift-cards/${product.slug}`}
                          className="flex min-h-11 items-center text-sm font-semibold text-nova-bone hover:text-nova-ember-text"
                        >
                          {product.title}
                        </Link>
                        <span className="text-sm text-nova-ash">{formatPrice(item.price)}</span>
                      </div>
                    </div>
                  );
                }
                const game = games.find((g) => g.id === item.gameId);
                if (!game) return null;
                return (
                  <div key={item.id} className="flex items-center gap-4 rounded-lg border border-nova-hairline bg-nova-crypt p-4">
                    <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md border border-nova-hairline bg-nova-slab">
                      <Image src={game.coverImageUrl} alt={game.title} fill sizes="64px" className="object-cover" />
                    </div>
                    <div className="flex flex-1 items-center justify-between gap-4">
                      <Link
                        href={`/games/${game.slug}`}
                        className="flex min-h-11 items-center text-sm font-semibold text-nova-bone hover:text-nova-ember-text"
                      >
                        {game.title}
                      </Link>
                      <span className="text-sm text-nova-ash">{formatPrice(item.price)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-nova-hairline pt-4">
              <span className="text-sm text-nova-ash">Amount paid</span>
              <span className="text-lg font-semibold text-nova-bone">{formatPrice(order.amountExact)}</span>
            </div>
          </section>

          {order.status === "approved" && (
            <section>
              {/* Heading follows what the order actually contains. It used to
                  be a hardcoded "Game Credentials" heading whose body skipped every
                  gift-card line, so a gift-card-only order rendered this
                  section completely empty and the buyer had no way to get
                  the code they'd paid for. */}
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-nova-smoke">
                {deliverablesHeading}
              </h2>
              <div className="flex flex-col gap-4">
                {items.map((item) => {
                  if (item.productType === "hardware") {
                    const product = item.hardwareProductId
                      ? hardwareById[item.hardwareProductId]
                      : undefined;
                    if (!product) return null;
                    // Physical goods have nothing to reveal — no
                    // credential, no code. Rendering nothing here would
                    // leave an approved hardware order with a heading and
                    // an empty box, which is the exact failure a
                    // gift-card-only order used to hit. Say what actually
                    // happens next instead.
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-nova-hairline bg-nova-crypt p-4"
                      >
                        <p className="text-sm font-semibold text-nova-bone">{product.name}</p>
                        <p className="mt-1 text-xs text-nova-ash">
                          {HARDWARE_CATEGORY_LABELS[product.category]} &middot; being prepared for
                          dispatch. We&rsquo;ll confirm your delivery address and tracking over
                          WhatsApp.
                        </p>
                      </div>
                    );
                  }
                  if (item.productType === "gift_card") {
                    const product = item.giftCardCodeId
                      ? giftCardProductsByCodeId[item.giftCardCodeId]
                      : undefined;
                    if (!product) return null;
                    return (
                      <GiftCardCodeReveal
                        key={item.id}
                        orderId={order.id}
                        orderItemId={item.id}
                        orderRef={order.paymentReference}
                        productId={product.id}
                        productTitle={product.title}
                        redemptionInstructions={product.redemptionInstructions}
                      />
                    );
                  }
                  const game = games.find((g) => g.id === item.gameId);
                  if (!game) return null;
                  return (
                    <CredentialReveal
                      key={item.id}
                      orderId={order.id}
                      orderRef={order.paymentReference}
                      gameId={game.id}
                      gameTitle={game.title}
                      setupGuide={game.setupGuide}
                    />
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <aside>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-nova-smoke">Timeline</h2>
          <OrderTimeline order={order} />
        </aside>
      </div>
    </div>
  );
}
