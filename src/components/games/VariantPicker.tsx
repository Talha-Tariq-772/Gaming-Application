"use client";

import { useState } from "react";
import { chamferClipPath } from "@/src/components/ui/nova/Chamfer";
import { formatPrice } from "@/src/lib/format";
import type { Game } from "@/src/types/database";
import AddToCartButton from "./AddToCartButton";

const PILL_CHAMFER = 8;

/**
 * 'single' (every seeded game but gta-vi): one variant, no picker, just its
 * price. 'multi' (gta-vi today): a pill per variant: selecting one drives
 * both the displayed price and which variant AddToCartButton adds.
 * Defaults to the first variant by sortOrder (catalog.ts's mapGameRow
 * already sorts ascending).
 */
export default function VariantPicker({
  game,
  inStock,
}: {
  game: Game;
  inStock: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(game.variants[0]?.id);
  const variant = game.variants.find((v) => v.id === selectedId) ?? game.variants[0];

  if (!variant) return null;

  return (
    <div className="flex flex-col gap-5">
      {game.variantMode === "multi" && (
        <div role="radiogroup" aria-label="Edition" className="flex flex-wrap gap-2">
          {game.variants.map((v) => {
            const selected = v.id === variant.id;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSelectedId(v.id)}
                style={chamferClipPath(PILL_CHAMFER)}
                className={`flex min-h-11 flex-col items-start justify-center border px-4 py-1.5 text-left transition-colors duration-(--duration-fast) ease-standard ${
                  selected
                    ? "border-nova-ember bg-nova-ember/10"
                    : "border-nova-hairline bg-nova-crypt hover:border-nova-ember/40"
                }`}
              >
                <span
                  className={`text-sm font-medium uppercase tracking-[0.06em] ${selected ? "text-nova-bone" : "text-nova-ash"}`}
                >
                  {v.label}
                </span>
                <span className="text-xs text-nova-smoke">{formatPrice(v.pricePkr)}</span>
              </button>
            );
          })}
        </div>
      )}

      <span className="flex items-baseline gap-3">
        {/* Session 9: no font-bold — text-3xl isn't one of the sizes the
            .font-display compound rules in globals.css cover, so this
            was requesting a weight Marcellus doesn't ship (font-synthesis:
            none now stops that from faking a synthetic bold, but the
            stale class was misleading). */}
        <span className="text-3xl font-display text-nova-bone">
          {formatPrice(variant.pricePkr)}
        </span>
        {variant.wasPricePkr !== null && (
          <span className="text-lg text-nova-smoke line-through">
            {formatPrice(variant.wasPricePkr)}
          </span>
        )}
      </span>

      {inStock ? (
        <AddToCartButton game={game} variant={variant} />
      ) : (
        <p
          style={chamferClipPath(10)}
          className="w-fit border border-nova-hairline bg-nova-crypt px-4 py-3 text-sm text-nova-ash"
        >
          Out of stock — check back soon.
        </p>
      )}
    </div>
  );
}
