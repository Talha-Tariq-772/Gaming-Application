"use client";

import Image from "next/image";
import Link from "next/link";
import Button from "@/components/Button";
import { useHydrated } from "@/src/lib/use-hydrated";
import { useFocusTrap } from "@/src/lib/use-focus-trap";
import { track } from "@/src/lib/analytics";
import { formatPrice } from "@/src/lib/format";
import { useCartSummary } from "@/src/lib/use-cart";
import { useCartStore } from "@/src/stores/cart-store";
import { useCartUIStore } from "@/src/stores/cart-ui-store";

export default function CartDrawer() {
  const hydrated = useHydrated();
  const isOpen = useCartUIStore((s) => s.isOpen);
  const close = useCartUIStore((s) => s.close);
  const removeItem = useCartStore((s) => s.removeItem);
  const { validItems, unavailableItems, hasUnavailableItem, total } =
    useCartSummary();
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen, close);

  // Guard against the SSR/persisted-state hydration mismatch (see useHydrated).
  const unavailableIds = new Set(unavailableItems.map((i) => i.gameId));
  const displayItems = hydrated ? [...validItems, ...unavailableItems] : [];
  const displayTotal = hydrated ? total : 0;

  return (
    <>
      <div
        onClick={close}
        aria-hidden="true"
        className={`fixed inset-0 z-50 bg-nova-void/70 transition-opacity duration-(--duration-base) ease-standard ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
        inert={!isOpen}
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-nova-hairline bg-nova-void transition-transform duration-(--duration-base) ease-standard sm:max-w-sm ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-nova-hairline px-6 py-4">
          <h2 className="font-display text-lg font-bold text-nova-bone">Cart</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close cart"
            className="-mr-2 flex h-11 w-11 items-center justify-center text-nova-ash hover:text-nova-bone"
          >
            ✕
          </button>
        </div>

        {displayItems.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-nova-ash">Your cart is empty.</p>
            <Button as="a" href="/games" variant="secondary" onClick={close}>
              Browse Store
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-6 py-4">
              {displayItems.map((item) => {
                const unavailable = unavailableIds.has(item.gameId);
                return (
                  <li
                    key={item.gameId}
                    className="flex gap-3 border-b border-nova-hairline py-4 first:pt-0 last:border-b-0"
                  >
                    <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md border border-nova-hairline bg-nova-crypt">
                      <Image
                        src={item.coverImageUrl}
                        alt={item.title}
                        fill
                        sizes="64px"
                        className={`object-cover ${unavailable ? "grayscale" : ""}`}
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <Link
                          href={`/games/${item.slug}`}
                          onClick={close}
                          className="wrap-break-word text-sm font-semibold text-nova-bone hover:text-nova-ember"
                        >
                          {item.title}
                        </Link>
                        <p className="mt-1 text-sm text-nova-ash">
                          {formatPrice(item.price)}
                        </p>
                        {unavailable && (
                          <p className="mt-1 text-xs font-semibold text-nova-blood">
                            No longer available
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          removeItem(item.gameId);
                          track("remove_from_cart", { gameId: item.gameId });
                        }}
                        className="-my-2.5 -ml-1 w-fit px-1 py-2.5 text-xs font-medium uppercase tracking-wider text-nova-smoke hover:text-nova-ember"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-nova-hairline px-6 py-4">
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="text-nova-ash">Total</span>
                <span className="text-lg font-semibold text-nova-bone">
                  {formatPrice(displayTotal)}
                </span>
              </div>
              {hasUnavailableItem && (
                <p className="mb-3 text-center text-xs text-nova-blood">
                  Remove unavailable items before checking out.
                </p>
              )}
              <Button
                as="a"
                href="/checkout"
                variant="primary"
                onClick={(e) => {
                  if (hasUnavailableItem) {
                    e.preventDefault();
                    return;
                  }
                  close();
                }}
                aria-disabled={hasUnavailableItem}
                className={`w-full ${
                  hasUnavailableItem ? "pointer-events-none opacity-40" : ""
                }`}
              >
                Checkout
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
