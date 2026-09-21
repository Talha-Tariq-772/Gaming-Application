"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import GiftCardImageField from "@/src/components/admin/GiftCardImageField";
import type { GiftCardImageKind } from "@/src/lib/actions/admin-images";
import { formatPrice } from "@/src/lib/format";
import { useToastStore } from "@/src/stores/toast-store";
import { GIFT_CARD_PLATFORM_LABELS, type GiftCardProduct } from "@/src/types/database";

/**
 * Gift-card image management.
 *
 * Scoped to art on purpose. Gift cards have no admin CRUD screen at all
 * today — they are seeded and managed in SQL — and inventing one here
 * would be a much larger change than the images this is for. Everything
 * on this page is read-only except the two image controls per product, so
 * it adds exactly the capability that was missing without silently taking
 * on the rest of a catalog editor.
 *
 * Each row links out to the live product page, so an admin can check the
 * result of an upload (or a removal, and the fallback it restores)
 * without hunting for the URL.
 */
export default function AdminGiftCardsClient({
  initialProducts,
}: {
  initialProducts: GiftCardProduct[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const showToast = useToastStore((s) => s.showToast);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    );
  }, [products, search]);

  const withCustomArt = products.filter((p) => p.cardImageUrl || p.headerImageUrl).length;

  function handleChanged(productId: string, kind: GiftCardImageKind, url: string | null) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, ...(kind === "card" ? { cardImageUrl: url } : { headerImageUrl: url }) }
          : p,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-bold text-nova-bone">Gift Card Images</h1>
        <p className="mt-1 text-sm text-nova-ash">
          {products.length} product{products.length === 1 ? "" : "s"} · {withCustomArt} with custom
          art
        </p>
      </div>

      <div className="rounded-lg border border-nova-hairline bg-nova-crypt p-4">
        <p className="text-sm text-nova-ash">
          Each gift card falls back to shared artwork when it has none of its own &mdash; the
          per-platform card face, and the standard Gift Cards banner. Removing an image restores
          that fallback; it never leaves a product without a picture.
        </p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search gift cards…"
        aria-label="Search gift cards"
        className="min-h-11 w-full max-w-xs rounded-md border border-nova-hairline bg-nova-crypt px-3 py-2 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
      />

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-nova-hairline bg-nova-crypt p-6 text-sm text-nova-ash">
          {products.length === 0
            ? "No gift card products yet."
            : "No gift cards match that search."}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {filtered.map((product) => (
            <li
              key={product.id}
              className="flex flex-col gap-4 rounded-lg border border-nova-hairline bg-nova-crypt p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-nova-bone">{product.title}</span>
                    {!product.isActive && (
                      <span className="rounded-full border border-nova-hairline px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-nova-smoke">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-nova-ash">
                    {GIFT_CARD_PLATFORM_LABELS[product.platform]} · {product.region} ·{" "}
                    {formatPrice(product.pricePkr)}
                  </p>
                </div>
                <Link
                  href={`/gift-cards/${product.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center text-xs font-semibold text-nova-ash hover:text-nova-bone"
                >
                  View page &rarr;
                </Link>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <GiftCardImageField
                  productId={product.id}
                  kind="card"
                  label="Card image"
                  hint="Shown on the catalog grid and the product page thumbnail."
                  currentUrl={product.cardImageUrl}
                  onChanged={(kind, url) => handleChanged(product.id, kind, url)}
                  onToast={showToast}
                />
                <GiftCardImageField
                  productId={product.id}
                  kind="header"
                  label="Header image"
                  hint="Full-width banner at the top of this product's page."
                  currentUrl={product.headerImageUrl}
                  onChanged={(kind, url) => handleChanged(product.id, kind, url)}
                  onToast={showToast}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
