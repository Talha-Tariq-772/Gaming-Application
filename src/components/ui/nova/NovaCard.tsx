import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { chamferClipPath } from "./Chamfer";
import { cssEase, dur } from "@/src/lib/motion";

const CHAMFER_SIZE = 14;

/**
 * Crypt surface, hairline border igniting to ember/40 on hover, chamfered
 * corner, scale(1.015). CSS-only — NOVA_DESIGN_SPEC.md #7 is explicit that
 * card-level "heavy" motion in the catalog comes from CSS, not JS ("CSS
 * card ignite... costs nothing"), matching how GameCard.tsx already does
 * its own hover (group-hover + transition-colors, no client component).
 * `motion-reduce:transition-none` handles prefers-reduced-motion — no
 * useEffect/matchMedia branch needed since there's no JS animation to
 * conditionally skip in the first place.
 *
 * Cover-image displacement (section 5's "+ cover-image displacement") is
 * left to the caller, same as GameCard's own `scale-110` on its <Image> —
 * this primitive doesn't assume a card always has one.
 */
export default function NovaCard({
  className,
  children,
  ...rest
}: {
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"div">, "style" | "className" | "children">) {
  return (
    <div
      className={`border border-nova-hairline bg-nova-crypt transition-[border-color,transform] hover:scale-[1.015] hover:border-nova-ember/40 motion-reduce:transition-none motion-reduce:hover:scale-100 ${className ?? ""}`}
      style={{
        ...chamferClipPath(CHAMFER_SIZE),
        transitionDuration: `${dur.hover}s`,
        transitionTimingFunction: cssEase.out,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
