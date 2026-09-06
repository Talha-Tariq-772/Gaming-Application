"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GIFT_CARD_PLATFORMS, GIFT_CARD_PLATFORM_LABELS, GIFT_CARD_REGIONS, GIFT_CARD_REGION_LABELS } from "@/src/types/database";

/**
 * Same URL-state pattern as StoreFilterBar.tsx (toggleListParam, plain
 * useSearchParams/useRouter, no nuqs) — mirrored rather than shared as a
 * single generic component because the two filter sets (genre/platform/
 * price vs platform/region) don't overlap enough to be one parameterized
 * component without more indirection than the duplication it would save.
 */

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name", label: "Name" },
] as const;

function parseList(value: string | null): string[] {
  return value ? value.split(",") : [];
}

const DROPDOWN_PANEL_CLASSES =
  "absolute z-10 mt-2 flex min-w-48 flex-col gap-2 rounded-md border border-nova-hairline bg-nova-crypt p-4 shadow-lg";

const SUMMARY_CLASSES =
  "min-h-11 list-none rounded-full border border-nova-hairline bg-nova-crypt px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-nova-bone [&::-webkit-details-marker]:hidden";

export default function GiftCardFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedPlatforms = parseList(searchParams.get("platform"));
  const selectedRegions = parseList(searchParams.get("region"));
  const sort = searchParams.get("sort") ?? "newest";

  const hasActiveFilters = selectedPlatforms.length > 0 || selectedRegions.length > 0;

  function commit(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function toggleListParam(key: "platform" | "region", value: string, current: string[]) {
    commit((params) => {
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      if (next.length === 0) params.delete(key);
      else params.set(key, next.join(","));
    });
  }

  function setSort(value: string) {
    commit((params) => {
      if (value === "newest") params.delete("sort");
      else params.set("sort", value);
    });
  }

  return (
    <div
      role="group"
      aria-label="Filters"
      className="mb-8 flex flex-wrap items-center gap-3 border-b border-nova-hairline pb-6"
    >
      <details className="relative">
        <summary className={SUMMARY_CLASSES}>
          Platform{selectedPlatforms.length > 0 ? ` (${selectedPlatforms.length})` : ""}
        </summary>
        <div className={DROPDOWN_PANEL_CLASSES}>
          {GIFT_CARD_PLATFORMS.map((platform) => (
            <label key={platform} className="flex min-h-11 items-center gap-2 py-1 text-sm text-nova-ash">
              <input
                type="checkbox"
                checked={selectedPlatforms.includes(platform)}
                onChange={() => toggleListParam("platform", platform, selectedPlatforms)}
                className="h-4 w-4 rounded border-nova-hairline bg-nova-crypt accent-nova-ember"
              />
              {GIFT_CARD_PLATFORM_LABELS[platform]}
            </label>
          ))}
        </div>
      </details>

      <details className="relative">
        <summary className={SUMMARY_CLASSES}>
          Region{selectedRegions.length > 0 ? ` (${selectedRegions.length})` : ""}
        </summary>
        <div className={DROPDOWN_PANEL_CLASSES}>
          {GIFT_CARD_REGIONS.map((region) => (
            <label key={region} className="flex min-h-11 items-center gap-2 py-1 text-sm text-nova-ash">
              <input
                type="checkbox"
                checked={selectedRegions.includes(region)}
                onChange={() => toggleListParam("region", region, selectedRegions)}
                className="h-4 w-4 rounded border-nova-hairline bg-nova-crypt accent-nova-ember"
              />
              {GIFT_CARD_REGION_LABELS[region]}
            </label>
          ))}
        </div>
      </details>

      <label className="ml-auto flex items-center gap-2 text-sm text-nova-ash">
        Sort by
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="min-h-11 rounded-md border border-nova-hairline bg-nova-crypt px-3 py-2 text-sm text-nova-bone focus:border-nova-ember focus:outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {hasActiveFilters && (
        <Link
          href={pathname}
          className="min-h-11 content-center text-xs font-semibold uppercase tracking-[0.08em] text-nova-ember-text hover:text-nova-ember-lo"
        >
          Clear all
        </Link>
      )}
    </div>
  );
}
