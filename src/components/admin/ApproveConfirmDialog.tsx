"use client";

import { useRef, useState } from "react";
import AdminModal, { AdminDialogFooter } from "@/src/components/admin/AdminModal";
import { formatPriceExact } from "@/src/lib/format";
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

  function handleConfirm() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    onConfirm();
  }

  return (
    <AdminModal onCancel={onCancel} role="alertdialog" ariaLabel="Confirm approval">
      <h2 className="text-lg font-bold text-nova-bone">Approve this order?</h2>
      <p className="mt-3 text-sm text-nova-ash">
        This releases game credentials to the customer. Confirm the amount
        received matches exactly:
      </p>
      <p className="mt-3 text-3xl font-bold text-nova-bone">
        {formatPriceExact(order.amountExact)}
      </p>
      <p className="mt-1 font-mono text-sm text-nova-smoke">
        {order.paymentReference}
      </p>
      <AdminDialogFooter
        onCancel={onCancel}
        onConfirm={handleConfirm}
        isSubmitting={isSubmitting}
        confirmVariant="primary"
        confirmLabel="Confirm Approve"
        confirmingLabel="Approving…"
      />
    </AdminModal>
  );
}
