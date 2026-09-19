"use client";

import { useRef, useState } from "react";
import AdminModal, { AdminDialogFooter } from "@/src/components/admin/AdminModal";
import { isSyntheticAuthEmail } from "@/src/lib/phone";
import type { Profile } from "@/src/types/database";

export default function DeleteUserDialog({
  profile,
  orderCount,
  willHardDelete,
  error,
  onCancel,
  onConfirm,
}: {
  profile: Profile;
  /** From previewUserDeletion — null while that lookup is still in flight. */
  orderCount: number | null;
  /** Best-effort hint for the copy — the server re-derives this for real before acting. */
  willHardDelete: boolean | null;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const identifier = isSyntheticAuthEmail(profile.email)
    ? (profile.phoneNumber ?? profile.id)
    : (profile.email ?? profile.id);
  const isLoadingPreview = orderCount === null || willHardDelete === null;

  function handleConfirm() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    onConfirm();
  }

  return (
    <AdminModal onCancel={onCancel} role="alertdialog" ariaLabel="Confirm delete user">
      <h2 className="text-lg font-bold text-nova-bone">Delete this user?</h2>

      {isLoadingPreview ? (
        <p className="mt-3 text-sm text-nova-ash">Checking order history…</p>
      ) : willHardDelete ? (
        <p className="mt-3 text-sm text-nova-ash">
          <span className="font-semibold text-nova-bone">{identifier}</span> has no order, review, or audit
          history — this permanently removes the account.
        </p>
      ) : (
        <p className="mt-3 text-sm text-nova-ash">
          <span className="font-semibold text-nova-bone">{identifier}</span> has{" "}
          <span className="font-semibold text-nova-bone">
            {orderCount} order{orderCount === 1 ? "" : "s"}
          </span>{" "}
          on file, so it can&rsquo;t be permanently deleted without breaking that history. The account will be
          deactivated instead — it can never sign in again, but its orders stay intact and correctly attributed.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-nova-blood">{error}</p>}

      <AdminDialogFooter
        onCancel={onCancel}
        onConfirm={handleConfirm}
        isSubmitting={isSubmitting || isLoadingPreview}
        confirmVariant="destructive"
        confirmLabel={isLoadingPreview ? "Confirm" : willHardDelete ? "Confirm Delete" : "Confirm Deactivate"}
        confirmingLabel="Working…"
      />
    </AdminModal>
  );
}
