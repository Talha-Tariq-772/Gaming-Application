import type { CSSProperties, ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * The chamfered-corner clip-path from NOVA_DESIGN_SPEC.md #4, as a plain
 * function — exported so NovaButton/NovaCard can apply it to their own
 * root element directly (a <button> shouldn't need an extra wrapping <div>
 * just to get its corner cut). <Chamfer> below is the same thing as a
 * standalone wrapper, for anywhere else that wants the shape without
 * building its own component around it.
 */
export function chamferClipPath(size: number): CSSProperties {
  return {
    clipPath: `polygon(${size}px 0, 100% 0, 100% calc(100% - ${size}px), calc(100% - ${size}px) 100%, 0 100%, 0 ${size}px)`,
  };
}

const DEFAULT_SIZE = 14;

export default function Chamfer({
  size = DEFAULT_SIZE,
  className,
  style,
  children,
  ...rest
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"div">, "style" | "className" | "children">) {
  return (
    <div className={className} style={{ ...chamferClipPath(size), ...style }} {...rest}>
      {children}
    </div>
  );
}
