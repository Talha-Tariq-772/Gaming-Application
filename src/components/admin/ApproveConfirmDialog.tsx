"use client";

import { useRef, useState } from "react";
import { formatPrice } from "@/src/lib/format";
import { useFocusTrap } from "@/src/lib/use-focus-trap";
import type { Order } from "@/src/types/database";

export default function ApproveConfirmDialog({
  order,
  onCancel,
  onConfirm,
}: {
  order: Order;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const panelRef = useFocusTrap<HTMLDivElement>(true, onCancel);

  function handleConfirm() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    onConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        onClick={onCancel}
        aria-hidden="true"
        className="absolute inset-0 bg-bg/80"
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirm approval"
        className="relative w-full max-w-sm rounded-lg border border-border bg-surface-1 p-6"
      >
        <h2 className="text-lg font-bold text-text">Approve this order?</h2>
        <p className="mt-3 text-sm text-text-muted">
          This releases game credentials to the customer. Confirm the amount
          received matches exactly:
        </p>
        <p className="mt-3 text-3xl font-bold text-text">
          {formatPrice(order.amountExact)}
        </p>
        <p className="mt-1 font-mono text-sm text-text-faint">
          {order.paymentReference}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="min-h-11 flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="min-h-11 flex-1 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-colors duration-(--duration-fast) ease-standard hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Approving…" : "Confirm Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}
