import type { OrderStatus } from "@/src/types/database";

const STATUS_CONFIG: Record<OrderStatus, { label: string; toneClass: string }> = {
  awaiting_payment: {
    label: "Awaiting payment",
    toneClass: "border-border-strong bg-surface-2 text-text-muted",
  },
  payment_claimed: {
    label: "Payment submitted",
    toneClass: "border-warning/30 bg-warning-dim text-warning",
  },
  under_review: {
    label: "Under review",
    toneClass: "border-warning/30 bg-warning-dim text-warning",
  },
  approved: {
    label: "Ready",
    toneClass: "border-success/30 bg-success-dim text-success",
  },
  rejected: {
    label: "Rejected",
    toneClass: "border-danger/30 bg-danger-dim text-danger",
  },
  expired: {
    label: "Expired",
    toneClass: "border-border-strong bg-surface-2 text-text-muted",
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
