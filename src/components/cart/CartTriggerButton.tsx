"use client";

import { useCartStore } from "@/src/stores/cart-store";
import { useCartUIStore } from "@/src/stores/cart-ui-store";
import { useHydrated } from "@/src/lib/use-hydrated";

export default function CartTriggerButton() {
  const hydrated = useHydrated();
  const count = useCartStore((s) => s.items.length);
  const open = useCartUIStore((s) => s.open);
  const displayCount = hydrated ? count : 0;

  return (
    <button
      type="button"
      onClick={open}
      aria-label={
        displayCount > 0 ? `Open cart, ${displayCount} items` : "Open cart"
      }
      className="relative flex h-11 w-11 items-center justify-center rounded-full border border-nova-hairline bg-nova-crypt text-nova-bone transition-colors duration-(--duration-fast) ease-standard hover:border-nova-ember/40"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path
          d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 8H6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="17" cy="20" r="1.5" />
      </svg>
      {displayCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-nova-ember-lo px-1 text-xs font-bold text-nova-bone">
          {displayCount}
        </span>
      )}
    </button>
  );
}
