"use client";

import { useRef, useState } from "react";
import AdminModal, { AdminDialogFooter } from "@/src/components/admin/AdminModal";
import type { Game } from "@/src/types/database";

export default function DeleteGameDialog({
  game,
  willHardDelete,
  onCancel,
  onConfirm,
}: {
  game: Game;
  /** Best-effort hint for the copy — the server re-derives this for real before acting. */
  willHardDelete: boolean;
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
      <h2 className="text-lg font-bold text-nova-bone">
        {willHardDelete ? "Delete this game?" : "Deactivate this game?"}
      </h2>
      <p className="mt-3 text-sm text-nova-ash">
        {willHardDelete ? (
          <>
            <span className="font-semibold text-nova-bone">{game.title}</span> has never been ordered
            or had credentials added — this permanently removes it.
          </>
        ) : (
          <>
            <span className="font-semibold text-nova-bone">{game.title}</span> has order or credential
            history, so it can&rsquo;t be permanently deleted without breaking that record. It will
            be deactivated (hidden from the store) instead.
          </>
        )}
      </p>
      <AdminDialogFooter
        onCancel={onCancel}
        onConfirm={handleConfirm}
        isSubmitting={isSubmitting}
        confirmVariant="destructive"
        confirmLabel={willHardDelete ? "Confirm Delete" : "Confirm Deactivate"}
        confirmingLabel="Working…"
      />
    </AdminModal>
  );
}
