import type { OrderStatus } from "@/src/types/database";

const STATUS_CONFIG: Record<OrderStatus, { label: string; toneClass: string }> = {
  awaiting_payment: {
    label: "Awaiting payment",
    toneClass: "border-nova-hairline bg-nova-slab text-nova-ash",
  },
  payment_claimed: {
    label: "Payment submitted",
    toneClass: "border-nova-gild/30 bg-nova-gild/15 text-nova-gild",
  },
  under_review: {
    label: "Under review",
    toneClass: "border-nova-gild/30 bg-nova-gild/15 text-nova-gild",
  },
  approved: {
    label: "Ready",
    // Part A3: ember text against this tint measures 3.27:1 (crypt
    // backdrop), and plain ember text can't clear 4.5:1 against any of the
    // app's dark surfaces at all (max 3.94:1, on void) — no tint alpha
    // fixes that. Bone text keeps the tinted border/fill for color-coding
    // while staying legible.
    toneClass: "border-nova-ember/30 bg-nova-ember/15 text-nova-bone",
  },
  rejected: {
    label: "Rejected",
    // Same issue as approved above — blood text on this tint measures
    // 4.04:1.
    toneClass: "border-nova-blood/30 bg-nova-blood/15 text-nova-bone",
  },
  expired: {
    label: "Expired",
    toneClass: "border-nova-hairline bg-nova-slab text-nova-ash",
  },
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${config.toneClass}`}
    >
      {config.label}
    </span>
  );
}
