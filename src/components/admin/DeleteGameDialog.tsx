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
      <h2 className="text-lg font-bold text-nova-bone">Delete this game?</h2>
      <p className="mt-3 text-sm text-nova-ash">
        {willHardDelete ? (
          <>
            <span className="font-semibold text-nova-bone">{game.title}</span> has never been ordered
            or had credentials added &mdash; this permanently removes it, along with its variants and
            any uploaded cover or header art.
          </>
        ) : (
          <>
            <span className="font-semibold text-nova-bone">{game.title}</span> has order or credential
            history, so the delete will be refused &mdash; removing it would break that record. Set it
            inactive instead to hide it from the store.
          </>
        )}
      </p>
      {/* Deliberately still shows a Delete button in the blocked case
          rather than hiding it: willHardDelete is a client-side HINT
          (derived from credential stock only, so it cannot see pure order
          history), and the server re-derives the real answer. Letting the
          admin press it and get the refusal toast is honest; greying out a
          button on a guess that might be wrong is not. */}
      <AdminDialogFooter
        onCancel={onCancel}
        onConfirm={handleConfirm}
        isSubmitting={isSubmitting}
        confirmVariant="destructive"
        confirmLabel="Confirm Delete"
        confirmingLabel="Working…"
      />
    </AdminModal>
  );
}
