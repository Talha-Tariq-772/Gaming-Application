/**
 * NOVA_DESIGN_SPEC.md #4 divider — a 1px line that fades at both ends,
 * rather than a hard-edged <hr>. Static; nothing to animate.
 */
export default function FadeDivider({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-px w-full ${className ?? ""}`}
      style={{
        background: "linear-gradient(90deg, transparent, var(--color-nova-hairline), transparent)",
      }}
    />
  );
}
