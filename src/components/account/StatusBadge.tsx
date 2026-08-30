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
    toneClass: "border-nova-ember/30 bg-nova-ember/15 text-nova-ember",
  },
  rejected: {
    label: "Rejected",
    toneClass: "border-nova-blood/30 bg-nova-blood/15 text-nova-blood",
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
