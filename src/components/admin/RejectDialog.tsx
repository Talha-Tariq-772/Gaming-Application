"use client";

import { useRef, useState } from "react";
import AdminField, { ADMIN_INPUT_CLASS } from "@/src/components/admin/AdminField";
import AdminModal, { AdminDialogFooter } from "@/src/components/admin/AdminModal";
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
    <AdminModal onCancel={onCancel} ariaLabel="Reject order">
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

      <div className="mt-4">
        <AdminField label="Notes (optional)" htmlFor="reject-notes" error={notesError}>
          <textarea
            id="reject-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => setNotesTouched(true)}
            rows={3}
            aria-invalid={Boolean(notesError)}
            aria-describedby={notesError ? "reject-notes-error" : undefined}
            className={ADMIN_INPUT_CLASS}
            placeholder="Add any extra detail for the customer or your own records…"
          />
        </AdminField>
      </div>

      <AdminDialogFooter
        onCancel={onCancel}
        onConfirm={handleConfirm}
        isSubmitting={isSubmitting}
        confirmVariant="destructive"
        confirmLabel="Confirm Reject"
        confirmingLabel="Rejecting…"
      />
    </AdminModal>
  );
}
