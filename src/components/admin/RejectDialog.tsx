"use client";

import { useRef, useState } from "react";
import { useFocusTrap } from "@/src/lib/use-focus-trap";
import { rejectFormSchema } from "@/src/lib/validation";

const REJECTION_REASONS = [
  "Amount didn't match the exact reconciliation amount",
  "No matching transaction found",
  "Payment screenshot unclear or unreadable",
  "Duplicate submission — already reviewed",
  "Suspected fraudulent payment",
  "Other",
];

export default function RejectDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [selected, setSelected] = useState(REJECTION_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [notesTouched, setNotesTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const panelRef = useFocusTrap<HTMLDivElement>(true, onCancel);

  const parsed = rejectFormSchema.safeParse({ reason: selected, notes });
  const notesError =
    notesTouched && !parsed.success
      ? parsed.error.issues.find((i) => i.path[0] === "notes")?.message
      : undefined;

  function handleConfirm() {
    if (submittingRef.current || !parsed.success) {
      setNotesTouched(true);
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    const reason = parsed.data.notes
      ? `${parsed.data.reason} — ${parsed.data.notes}`
      : parsed.data.reason;
    onConfirm(reason);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        onClick={onCancel}
        aria-hidden="true"
        className="absolute inset-0 bg-nova-void/80"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Reject order"
        className="relative flex max-h-[90vh] w-full max-w-sm flex-col overflow-y-auto rounded-lg border border-nova-hairline bg-nova-crypt p-6"
      >
        <h2 className="text-lg font-bold text-nova-bone">Reject this order</h2>

        <fieldset className="mt-4 flex flex-col border-0 p-0">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-nova-smoke">
            Reason
          </legend>
          {REJECTION_REASONS.map((reason) => (
            <label
              key={reason}
              className="flex min-h-11 items-center gap-2 py-2 text-sm text-nova-ash"
            >
              <input
                type="radio"
                name="reject-reason"
                checked={selected === reason}
                onChange={() => setSelected(reason)}
                className="shrink-0 accent-nova-ember"
              />
              {reason}
            </label>
          ))}
        </fieldset>

        <label
          htmlFor="reject-notes"
          className="mt-4 block text-xs font-semibold uppercase tracking-wider text-nova-smoke"
        >
          Notes (optional)
        </label>
        <textarea
          id="reject-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => setNotesTouched(true)}
          rows={3}
          aria-invalid={Boolean(notesError)}
          aria-describedby={notesError ? "reject-notes-error" : undefined}
          className="mt-2 w-full rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
          placeholder="Add any extra detail for the customer or your own records…"
        />
        {notesError && (
          <p id="reject-notes-error" className="mt-1 text-xs text-nova-blood">
            {notesError}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="min-h-11 flex-1 rounded-md border border-nova-hairline px-4 py-2 text-sm font-medium text-nova-ash hover:text-nova-bone disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="min-h-11 flex-1 rounded-md bg-nova-blood px-4 py-2 text-sm font-semibold text-nova-void transition-opacity duration-(--duration-fast) ease-standard hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Rejecting…" : "Confirm Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}
