"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { track } from "@/src/lib/analytics";
import { formatPrice } from "@/src/lib/format";

const STEP = 50;

// The input's own box is the real touch target (44px tall, per WCAG), kept
// separate from the visual track/thumb which stay slim and centered inside it.
const THUMB_CLASSNAME =
  "pointer-events-none absolute inset-0 h-11 w-full cursor-pointer appearance-none bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 " +
  "[&::-webkit-slider-thumb]:border-nova-void [&::-webkit-slider-thumb]:bg-nova-ember " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 " +
  "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 " +
  "[&::-moz-range-thumb]:border-nova-void [&::-moz-range-thumb]:bg-nova-ember " +
  "[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent";

export default function PriceRangeSlider({
  bounds,
}: {
  bounds: { min: number; max: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlMin = Number(searchParams.get("minPrice") ?? bounds.min);
  const urlMax = Number(searchParams.get("maxPrice") ?? bounds.max);

  const [min, setMin] = useState(urlMin);
  const [max, setMax] = useState(urlMax);
  const [activeThumb, setActiveThumb] = useState<"min" | "max" | null>(null);

  useEffect(() => {
    setMin(urlMin);
    setMax(urlMax);
  }, [urlMin, urlMax]);

  function commit(nextMin: number, nextMax: number) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextMin <= bounds.min) params.delete("minPrice");
    else params.set("minPrice", String(nextMin));

    if (nextMax >= bounds.max) params.delete("maxPrice");
    else params.set("maxPrice", String(nextMax));

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    track("filter_games", {
      filterType: "price",
      value: `${nextMin}-${nextMax}`,
    });
  }

  const range = bounds.max - bounds.min || 1;
  const minPct = ((min - bounds.min) / range) * 100;
  const maxPct = ((max - bounds.min) / range) * 100;

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-nova-ash">
        <span>{formatPrice(min)}</span>
        <span>{formatPrice(max)}</span>
      </div>
      <div className="relative mt-3 h-11">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-nova-slab" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-nova-ember"
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
        />
        <input
          type="range"
          aria-label="Minimum price"
          min={bounds.min}
          max={bounds.max}
          step={STEP}
          value={min}
          onPointerDown={() => setActiveThumb("min")}
          onInput={(e) =>
            setMin(Math.min(Number(e.currentTarget.value), max - STEP))
          }
          onChange={(e) => commit(Number(e.currentTarget.value), max)}
          className={THUMB_CLASSNAME}
          style={{ zIndex: activeThumb === "min" ? 5 : 3 }}
        />
        <input
          type="range"
          aria-label="Maximum price"
          min={bounds.min}
          max={bounds.max}
          step={STEP}
          value={max}
          onPointerDown={() => setActiveThumb("max")}
          onInput={(e) =>
            setMax(Math.max(Number(e.currentTarget.value), min + STEP))
          }
          onChange={(e) => commit(min, Number(e.currentTarget.value))}
          className={THUMB_CLASSNAME}
          style={{ zIndex: activeThumb === "max" ? 5 : 3 }}
        />
      </div>
    </div>
  );
}
