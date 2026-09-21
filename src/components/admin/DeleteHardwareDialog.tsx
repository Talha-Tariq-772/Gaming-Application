"use client";

import { useRef, useState } from "react";
import AdminModal, { AdminDialogFooter } from "@/src/components/admin/AdminModal";
import type { AdminHardwareProduct } from "@/src/types/database";

export default function DeleteHardwareDialog({
  product,
  onCancel,
  onConfirm,
}: {
  product: AdminHardwareProduct;
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
    <AdminModal onCancel={onCancel} role="alertdialog" ariaLabel="Confirm delete">
      <h2 className="text-lg font-bold text-nova-bone">Delete this product?</h2>
      <p className="mt-3 text-sm text-nova-ash">
        <span className="font-semibold text-nova-bone">{product.name}</span> will be permanently
        removed, along with its {product.stockQuantity} unit
        {product.stockQuantity === 1 ? "" : "s"} of recorded stock.
      </p>
      <p className="mt-3 text-sm text-nova-smoke">
        If it appears on any existing order the delete is refused — order history references the
        product row. Set it inactive instead to pull it from the store while keeping that history
        intact.
      </p>
      <AdminDialogFooter
        onCancel={onCancel}
        onConfirm={handleConfirm}
        isSubmitting={isSubmitting}
        confirmVariant="destructive"
        confirmLabel="Confirm Delete"
        confirmingLabel="Deleting…"
      />
    </AdminModal>
  );
}
