/**
 * Reserves StoreSlider's real footprint during app/(storefront)/games's
 * route-level loading.tsx window — same `height: clamp(420px, 45vw, 620px)`
 * inline style StoreSlider.tsx itself uses (measured: exactly 620px at
 * 1440px width, exactly 420px at 390px), so reserved height matches real
 * height at every viewport rather than two hand-picked breakpoint values.
 */
export default function StoreSliderSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="w-full animate-pulse bg-nova-crypt"
      style={{ height: "clamp(420px, 45vw, 620px)" }}
    />
  );
}
