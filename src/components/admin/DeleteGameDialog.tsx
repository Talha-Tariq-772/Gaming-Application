"use client";

import { useRef, useState } from "react";
import { useFocusTrap } from "@/src/lib/use-focus-trap";
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
  const panelRef = useFocusTrap<HTMLDivElement>(true, onCancel);

  function handleConfirm() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    onConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div onClick={onCancel} aria-hidden="true" className="absolute inset-0 bg-bg/80" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirm delete"
        className="relative w-full max-w-sm rounded-lg border border-border bg-surface-1 p-6"
      >
        <h2 className="text-lg font-bold text-text">
          {willHardDelete ? "Delete this game?" : "Deactivate this game?"}
        </h2>
        <p className="mt-3 text-sm text-text-muted">
          {willHardDelete ? (
            <>
              <span className="font-semibold text-text">{game.title}</span> has never been ordered
              or had credentials added — this permanently removes it.
            </>
          ) : (
            <>
              <span className="font-semibold text-text">{game.title}</span> has order or credential
              history, so it can&rsquo;t be permanently deleted without breaking that record. It will
              be deactivated (hidden from the store) instead.
            </>
          )}
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
            className="min-h-11 flex-1 rounded-md bg-danger px-4 py-2 text-sm font-semibold text-bg transition-opacity duration-(--duration-fast) ease-standard hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Working…" : willHardDelete ? "Confirm Delete" : "Confirm Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}
