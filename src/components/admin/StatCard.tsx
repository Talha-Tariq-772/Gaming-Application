"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/src/lib/motion-guards";
import { DURATION_SLOW, EASE_STANDARD } from "@/src/lib/motion-tokens";

/**
 * Counts up from 0 to `value` on mount. The <p> is server-rendered at its
 * final formatted value (via `format(value)`, or plain String() if no
 * formatter) so there's no hydration mismatch and reduced-motion users
 * simply never see it move — gsap only takes over textContent (bypassing
 * React state, so no re-render per tick) once mounted, and only when
 * motion is allowed. gsap-core is dynamic-imported (not a static top-level
 * import) so it doesn't add to the admin dashboard's initial bundle — six
 * of these render at once on page load, but none of them need gsap
 * parsed/executed before first paint, only shortly after.
 */
export default function StatCard({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format?: (value: number) => string;
}) {
  const fmt = format ?? String;
  const valueEl = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const el = valueEl.current;
    if (!el) return;

    let cancelled = false;
    let tween: { kill: () => void } | undefined;

    import("@/src/lib/gsap-core").then(({ gsap }) => {
      if (cancelled) return;
      const counter = { value: 0 };
      tween = gsap.to(counter, {
        value,
        duration: DURATION_SLOW,
        ease: EASE_STANDARD,
        onUpdate: () => {
          el.textContent = fmt(Math.round(counter.value));
        },
      });
    });

    return () => {
      cancelled = true;
      tween?.kill();
    };
  }, [value, fmt]);

  return (
    <div className="rounded-lg border border-nova-hairline bg-nova-crypt p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-nova-smoke">
        {label}
      </p>
      <p ref={valueEl} className="mt-2 text-2xl font-bold text-nova-bone">
        {fmt(value)}
      </p>
    </div>
  );
}
