"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/Button";
import { MOCK_GAMES } from "@/src/lib/mock-data";
import { buildPendingOrder } from "@/src/lib/order";
import { useCartStore } from "@/src/stores/cart-store";
import { useCartUIStore } from "@/src/stores/cart-ui-store";
import { useCheckoutStore } from "@/src/stores/checkout-store";
import { useGamesStore } from "@/src/stores/games-store";
import { useOrdersStore } from "@/src/stores/orders-store";
import type { Order, OrderItem } from "@/src/types/database";

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-nova-hairline bg-nova-crypt p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-nova-bone">{title}</p>
        <p className="mt-1 text-xs text-nova-ash">{description}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-3">{children}</div>
    </div>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-bold text-nova-bone">{heading}</h2>
      {children}
    </section>
  );
}

/**
 * DEV ONLY. Reviews every failure/edge-case/empty state built for the
 * resilience audit without having to manually reproduce each one —
 * REMOVE THIS ENTIRE app/dev DIRECTORY BEFORE PRODUCTION. Nothing here
 * is linked from anywhere in the real app.
 *
 * AuthProvider now lives at the root layout (app/layout.tsx), so /dev
 * inherits it automatically — no local wrapping needed anymore.
 */
export default function DevStatesPage() {
  return <DevStatesContent />;
}

function DevStatesContent() {
  const router = useRouter();

  const addItem = useCartStore((s) => s.addItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const openCart = useCartUIStore((s) => s.open);
  const updateGame = useGamesStore((s) => s.updateGame);
  const addOrder = useOrdersStore((s) => s.addOrder);
  const applyOverride = useOrdersStore((s) => s.applyOverride);

  const [storagePatched, setStoragePatched] = useState(false);

  function seedOrder(overrides: Partial<Order> = {}): Order {
    const order = buildPendingOrder({
      totalAmount: 2499,
      paymentMethodId: "pm-jazzcash",
      userId: "usr_ayesha01",
    });
    Object.assign(order, overrides);
    const items: OrderItem[] = [
      {
        id: crypto.randomUUID(),
        orderId: order.id,
        gameId: "game-1",
        giftCardCodeId: null,
        hardwareProductId: null,
        productType: "game",
        price: 2499,
      },
    ];
    addOrder(order, items);
    return order;
  }

  function goToCheckoutStep2(order: Order) {
    useCheckoutStore.setState({ step: 2, order, paymentMethodId: "pm-jazzcash" });
    router.push("/checkout");
  }

  function seedInactiveGameInCart() {
    const game = MOCK_GAMES[0];
    updateGame(game.id, { isActive: true }); // reset first, in case it was left inactive
    addItem(game);
    updateGame(game.id, { isActive: false });
    openCart();
  }

  function seedExpiredReservation() {
    const order = seedOrder({
      reservedUntil: new Date(Date.now() + 5000).toISOString(),
    });
    goToCheckoutStep2(order);
  }

  function seedAlreadyApprovedOrder() {
    const order = seedOrder();
    applyOverride(order.id, {
      status: "approved",
      reviewedAt: new Date().toISOString(),
    });
    goToCheckoutStep2(order);
  }

  function seedTenPlusCartItems() {
    clearCart();
    MOCK_GAMES.filter((g) => g.isActive)
      .slice(0, 11)
      .forEach((g) => addItem(g));
    openCart();
  }

  function toggleStoragePatch() {
    if (!storagePatched) {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function patchedSetItem() {
        throw new DOMException(
          "Simulated storage failure (dev toggle)",
          "QuotaExceededError",
        );
      };
      (window as unknown as { __gkOriginalSetItem?: typeof original }).__gkOriginalSetItem =
        original;
      setStoragePatched(true);
    } else {
      const original = (
        window as unknown as { __gkOriginalSetItem?: typeof Storage.prototype.setItem }
      ).__gkOriginalSetItem;
      if (original) Storage.prototype.setItem = original;
      setStoragePatched(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-page flex-col gap-12 px-4 py-16 md:px-8">
      <div className="rounded-lg border border-nova-gild/30 bg-nova-gild/15 px-6 py-4">
        <p className="text-sm font-bold text-nova-gild">
          DEV ONLY — REMOVE app/dev BEFORE PRODUCTION
        </p>
        <p className="mt-1 text-sm text-nova-ash">
          This page exists to review every failure/edge-case/empty state
          from the resilience audit without manually reproducing each one.
          It isn&rsquo;t linked from anywhere in the real app. Some
          actions below mutate shared demo data (cart, checkout, order
          overrides) — refresh to reset.
        </p>
      </div>

      <Section heading="Route-level">
        <Row
          title="404 — not found"
          description="Styled 404 with a link back to the store."
        >
          <Button as="a" href="/dev/states/this-page-does-not-exist" variant="secondary">
            Visit
          </Button>
        </Row>
        <Row
          title="Route error boundary"
          description="app/error.tsx — no stack trace shown, has a reset action."
        >
          <Button as="a" href="/dev/states/route-error" variant="secondary">
            Visit
          </Button>
        </Row>
        <Row
          title="Section error boundary"
          description="A failing section shows an inline retry + failure toast; the rest of the page stays intact."
        >
          <Button as="a" href="/dev/states/section-error" variant="secondary">
            Visit
          </Button>
        </Row>
        <Row
          title="global-error.tsx"
          description="Only fires if the ROOT layout itself throws — not realistically triggerable from a link. Read the file directly to review it."
        >
          <span className="text-xs text-nova-smoke">app/global-error.tsx</span>
        </Row>
        <Row
          title="loading.tsx"
          description="Route-level Suspense fallback, shown briefly on navigation. Throttle network in devtools (Slow 3G) to see it clearly."
        >
          <Button as="a" href="/games" variant="secondary">
            Visit /games
          </Button>
        </Row>
      </Section>

      <Section heading="Empty states">
        <Row
          title="Catalog: no filter matches"
          description="Reset-filters button."
        >
          <Button as="a" href="/games?minPrice=999999" variant="secondary">
            Visit
          </Button>
        </Row>
        <Row title="Empty cart" description="Clears the cart, then opens it.">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              clearCart();
              openCart();
            }}
          >
            Clear &amp; open cart
          </Button>
        </Row>
        <Row
          title="/account: no orders"
          description="Every seeded demo profile has order history, so this isn't reachable via DevAuthToggle — verified by code review instead (see AccountPage's myOrders.length === 0 branch)."
        >
          <span className="text-xs text-nova-smoke">
            app/(storefront)/account/page.tsx
          </span>
        </Row>
        <Row
          title="Guides search: no results"
          description="Browse-FAQ fallback action."
        >
          <Button as="a" href="/guides?q=zzznonexistentzzz" variant="secondary">
            Visit
          </Button>
        </Row>
        <Row
          title="Admin queue: nothing pending (good state)"
          description="Seeded demo data always has pending orders, so this needs every pending order approved/rejected first via the real admin UI — that's a deliberate one-way action, not something this page auto-seeds."
        >
          <Button as="a" href="/admin" variant="secondary">
            Visit /admin
          </Button>
        </Row>
      </Section>

      <Section heading="Edge cases">
        <Row
          title="Game goes inactive while in cart"
          description="Adds a game, deactivates it, opens the cart to show the warning + disabled checkout."
        >
          <Button type="button" variant="secondary" onClick={seedInactiveGameInCart}>
            Seed &amp; open cart
          </Button>
        </Row>
        <Row
          title="Reservation countdown reaches zero"
          description="Creates an order expiring in 5s and jumps to checkout step 2 — watch it expire."
        >
          <Button type="button" variant="secondary" onClick={seedExpiredReservation}>
            Seed &amp; go to checkout
          </Button>
        </Row>
        <Row
          title="Return to /checkout with an already-decided order"
          description="Creates an approved order, points checkout-store at it, then loads /checkout — should redirect to /account/orders/[id]."
        >
          <Button type="button" variant="secondary" onClick={seedAlreadyApprovedOrder}>
            Seed &amp; go to checkout
          </Button>
        </Row>
        <Row
          title="Very long title / no-line-break description"
          description="Crimson Horizon is seeded with a deliberately long title and description."
        >
          <Button as="a" href="/games/crimson-horizon" variant="secondary">
            Visit
          </Button>
        </Row>
        <Row title="Cart with 10+ items" description="Fills the cart and opens it.">
          <Button type="button" variant="secondary" onClick={seedTenPlusCartItems}>
            Seed &amp; open cart
          </Button>
        </Row>
        <Row
          title="Zero games in the catalog"
          description="Same extreme-filter view as the catalog empty state above — a true zero-total catalog requires deactivating every game via /admin."
        >
          <Button as="a" href="/games?minPrice=999999" variant="secondary">
            Visit
          </Button>
        </Row>
        <Row
          title="Offline"
          description="Not simulatable from a click — use devtools Network → Offline, or your OS's airplane mode, then try checkout."
        >
          <span className="text-xs text-nova-smoke">Manual — see description</span>
        </Row>
      </Section>

      <Section heading="Resilience">
        <Row
          title="Section failure → toast with Retry"
          description="Same trigger as the section error boundary above — the toast fires alongside the inline fallback."
        >
          <Button as="a" href="/dev/states/section-error" variant="secondary">
            Visit
          </Button>
        </Row>
        <Row
          title="localStorage unavailable"
          description="Patches Storage.prototype.setItem to throw (simulating Safari private mode) so you can add to cart and confirm it still works via in-memory fallback instead of crashing. Toggle off when done."
        >
          <Button type="button" variant="secondary" onClick={toggleStoragePatch}>
            {storagePatched ? "Restore localStorage" : "Simulate failure"}
          </Button>
          {storagePatched && (
            <Link
              href="/games"
              className="flex min-h-11 items-center text-xs font-semibold text-nova-ember-text hover:text-nova-ember-lo"
            >
              Go add something to cart →
            </Link>
          )}
        </Row>
      </Section>
    </div>
  );
}
