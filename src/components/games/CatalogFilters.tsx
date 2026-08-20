"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { track } from "@/src/lib/analytics";
import { PRICE_BOUNDS } from "@/src/lib/mock-data";
import { GAME_GENRES, GAME_PLATFORMS } from "@/src/types/database";
import PriceRangeSlider from "./PriceRangeSlider";

function parseList(value: string | null): string[] {
  return value ? value.split(",") : [];
}

export default function CatalogFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedGenres = parseList(searchParams.get("genre"));
  const selectedPlatforms = parseList(searchParams.get("platform"));

  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("q")]);

  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (search === current) return;

    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search) {
        params.set("q", search);
        track("filter_games", { filterType: "search", value: search });
      } else {
        params.delete("q");
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function toggleParam(key: "genre" | "platform", value: string, current: string[]) {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];

    const params = new URLSearchParams(searchParams.toString());
    if (next.length === 0) params.delete(key);
    else params.set(key, next.join(","));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    track("filter_games", { filterType: key, value });
  }

  const hasFilters =
    selectedGenres.length > 0 ||
    selectedPlatforms.length > 0 ||
    Boolean(searchParams.get("q")) ||
    Boolean(searchParams.get("minPrice")) ||
    Boolean(searchParams.get("maxPrice"));

  return (
    <div className="flex flex-col gap-8">
      {hasFilters && (
        <div className="flex justify-end">
          <Link
            href={pathname}
            className="text-xs font-semibold uppercase tracking-wider text-accent transition-colors duration-(--duration-fast) ease-standard hover:text-accent-strong"
          >
            Clear all
          </Link>
        </div>
      )}

      <div>
        <label
          htmlFor="game-search"
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-text-faint"
        >
          Search
        </label>
        <input
          id="game-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search games…"
          className="min-h-11 w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-text-faint">
          Genre
        </h3>
        <div className="flex flex-col gap-2">
          {GAME_GENRES.map((genre) => (
            <label
              key={genre}
              className="-my-1.5 flex min-h-11 items-center gap-2 py-1.5 text-sm text-text-muted"
            >
              <input
                type="checkbox"
                checked={selectedGenres.includes(genre)}
                onChange={() => toggleParam("genre", genre, selectedGenres)}
                className="h-4 w-4 rounded border-border bg-surface-1 accent-accent"
              />
              {genre}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-text-faint">
          Platform
        </h3>
        <div className="flex flex-col gap-2">
          {GAME_PLATFORMS.map((platform) => (
            <label
              key={platform}
              className="-my-1.5 flex min-h-11 items-center gap-2 py-1.5 text-sm text-text-muted"
            >
              <input
                type="checkbox"
                checked={selectedPlatforms.includes(platform)}
                onChange={() =>
                  toggleParam("platform", platform, selectedPlatforms)
                }
                className="h-4 w-4 rounded border-border bg-surface-1 accent-accent"
              />
              {platform}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-text-faint">
          Price
        </h3>
        <PriceRangeSlider bounds={PRICE_BOUNDS} />
      </div>
    </div>
  );
}
