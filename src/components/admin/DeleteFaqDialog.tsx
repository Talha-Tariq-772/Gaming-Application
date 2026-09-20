"use client";

import { useRef, useState } from "react";
import AdminModal, { AdminDialogFooter } from "@/src/components/admin/AdminModal";
import type { FaqItem } from "@/src/types/database";

export default function DeleteFaqDialog({
  faq,
  onCancel,
  onConfirm,
}: {
  faq: FaqItem;
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
      <h2 className="text-lg font-bold text-nova-bone">Delete this FAQ?</h2>
      <p className="mt-3 text-sm text-nova-ash">
        <span className="font-semibold text-nova-bone">{faq.question}</span> will be permanently
        removed. Nothing else in the app references an FAQ row, so no history is lost — but any
        existing link to{" "}
        <span className="font-mono text-xs text-nova-ash">/faq#{faq.slug}</span> will stop resolving.
      </p>
      <p className="mt-3 text-sm text-nova-smoke">
        To hide it from the public page while keeping the answer, unpublish it instead.
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
