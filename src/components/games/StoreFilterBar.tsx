"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { GAME_GENRES, GAME_PLATFORM_LABELS, GAME_PLATFORMS } from "@/src/types/database";

/**
 * All filter state lives in the URL (plain useSearchParams/useRouter, no
 * nuqs): this bar already needs router/pathname for navigation regardless,
 * the param shapes here are simple (comma-joined id lists, "1"-or-absent
 * flags) with no serialization nuqs would meaningfully simplify, and
 * CatalogFilters/SortSelect (this component's predecessors) already
 * established this exact pattern — matching it keeps one convention across
 * the codebase instead of two. Reaching for a dependency didn't buy enough
 * here to justify the bundle cost.
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

function chipClasses(active: boolean): string {
  return `min-h-11 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors duration-(--duration-fast) ease-standard ${
    active
      ? "border-nova-ember bg-nova-ember-lo text-nova-bone"
      : "border-nova-hairline bg-nova-crypt text-nova-ash hover:text-nova-bone"
  }`;
}

const DROPDOWN_PANEL_CLASSES =
  "absolute z-10 mt-2 flex min-w-48 flex-col gap-2 rounded-md border border-nova-hairline bg-nova-crypt p-4 shadow-lg";

const SUMMARY_CLASSES =
  "min-h-11 list-none rounded-full border border-nova-hairline bg-nova-crypt px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-nova-bone [&::-webkit-details-marker]:hidden";

export default function StoreFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedGenres = parseList(searchParams.get("genre"));
  const selectedPlatforms = parseList(searchParams.get("platform"));
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const newArrivals = searchParams.get("newArrivals") === "1";
  const bestSellers = searchParams.get("bestSellers") === "1";

  // Local draft text for the price inputs, committed to the URL on blur —
  // committing on every keystroke would fire a server request per digit.
  // Re-synced from the URL below so "Clear all" and browser back/forward
  // (which change searchParams without remounting this component) don't
  // leave stale text sitting in the inputs.
  const [minDraft, setMinDraft] = useState(minPrice);
  const [maxDraft, setMaxDraft] = useState(maxPrice);

  useEffect(() => setMinDraft(minPrice), [minPrice]);
  useEffect(() => setMaxDraft(maxPrice), [maxPrice]);

  const hasActiveFilters =
    selectedGenres.length > 0 ||
    selectedPlatforms.length > 0 ||
    minPrice !== "" ||
    maxPrice !== "" ||
    newArrivals ||
    bestSellers;

  function commit(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function toggleListParam(key: "genre" | "platform", value: string, current: string[]) {
    commit((params) => {
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      if (next.length === 0) params.delete(key);
      else params.set(key, next.join(","));
    });
  }

  function toggleFlag(key: "newArrivals" | "bestSellers", active: boolean) {
    commit((params) => {
      if (active) params.delete(key);
      else params.set(key, "1");
    });
  }

  function commitPrice(key: "minPrice" | "maxPrice", value: string) {
    commit((params) => {
      if (value === "") params.delete(key);
      else params.set(key, value);
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
      <button
        type="button"
        aria-pressed={newArrivals}
        onClick={() => toggleFlag("newArrivals", newArrivals)}
        className={chipClasses(newArrivals)}
      >
        New Arrivals
      </button>
      <button
        type="button"
        aria-pressed={bestSellers}
        onClick={() => toggleFlag("bestSellers", bestSellers)}
        className={chipClasses(bestSellers)}
      >
        Best Sellers
      </button>

      <details className="relative">
        <summary className={SUMMARY_CLASSES}>
          Genre{selectedGenres.length > 0 ? ` (${selectedGenres.length})` : ""}
        </summary>
        <div className={DROPDOWN_PANEL_CLASSES}>
          {GAME_GENRES.map((genre) => (
            <label key={genre} className="flex min-h-11 items-center gap-2 py-1 text-sm text-nova-ash">
              <input
                type="checkbox"
                checked={selectedGenres.includes(genre)}
                onChange={() => toggleListParam("genre", genre, selectedGenres)}
                className="h-4 w-4 rounded border-nova-hairline bg-nova-crypt accent-nova-ember"
              />
              {genre}
            </label>
          ))}
        </div>
      </details>

      <details className="relative">
        <summary className={SUMMARY_CLASSES}>
          Platform{selectedPlatforms.length > 0 ? ` (${selectedPlatforms.length})` : ""}
        </summary>
        <div className={DROPDOWN_PANEL_CLASSES}>
          {GAME_PLATFORMS.map((platform) => (
            <label key={platform} className="flex min-h-11 items-center gap-2 py-1 text-sm text-nova-ash">
              <input
                type="checkbox"
                checked={selectedPlatforms.includes(platform)}
                onChange={() => toggleListParam("platform", platform, selectedPlatforms)}
                className="h-4 w-4 rounded border-nova-hairline bg-nova-crypt accent-nova-ember"
              />
              {GAME_PLATFORM_LABELS[platform]}
            </label>
          ))}
        </div>
      </details>

      <details className="relative">
        <summary className={SUMMARY_CLASSES}>
          Price{minPrice || maxPrice ? " •" : ""}
        </summary>
        <div className={DROPDOWN_PANEL_CLASSES}>
          <label className="flex flex-col gap-1 text-xs text-nova-smoke">
            Min (Rs)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={minDraft}
              onChange={(e) => setMinDraft(e.target.value)}
              onBlur={() => commitPrice("minPrice", minDraft)}
              className="min-h-11 w-32 rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 text-sm text-nova-bone focus:border-nova-ember focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-nova-smoke">
            Max (Rs)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={maxDraft}
              onChange={(e) => setMaxDraft(e.target.value)}
              onBlur={() => commitPrice("maxPrice", maxDraft)}
              className="min-h-11 w-32 rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 text-sm text-nova-bone focus:border-nova-ember focus:outline-none"
            />
          </label>
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
          className="min-h-11 content-center text-xs font-semibold uppercase tracking-[0.08em] text-nova-ember hover:text-nova-ember-lo"
        >
          Clear all
        </Link>
      )}
    </div>
  );
}
