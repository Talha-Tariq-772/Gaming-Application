"use client";

import { useRef, useState } from "react";
import AdminModal, { AdminDialogFooter } from "@/src/components/admin/AdminModal";
import { isSyntheticAuthEmail } from "@/src/lib/phone";
import type { Profile, ProfileRole } from "@/src/types/database";

const ROLE_LABELS: Record<ProfileRole, string> = {
  customer: "Customer",
  agent: "Agent",
  admin: "Admin",
};

export default function ChangeRoleDialog({
  profile,
  newRole,
  isSelf,
  error,
  onCancel,
  onConfirm,
}: {
  profile: Profile;
  newRole: ProfileRole;
  isSelf: boolean;
  error: string | null;
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

  const isGrantingAdmin = newRole === "admin";
  const isRevokingAdmin = profile.role === "admin" && newRole !== "admin";
  const identifier = isSyntheticAuthEmail(profile.email)
    ? profile.phoneNumber ?? (profile.fullName ?? profile.id)
    : profile.email ?? profile.id;

  return (
    <AdminModal onCancel={onCancel} role="alertdialog" ariaLabel="Confirm role change">
      <h2 className="text-lg font-bold text-nova-bone">Change role?</h2>
      <p className="mt-3 text-sm text-nova-ash">
        Change <span className="font-medium text-nova-bone">{identifier}</span> from{" "}
        <span className="font-medium text-nova-bone">{ROLE_LABELS[profile.role]}</span> to{" "}
        <span className="font-medium text-nova-bone">{ROLE_LABELS[newRole]}</span>?
      </p>

      {isSelf && (
        <p className="mt-3 rounded-md border border-nova-gild/40 bg-nova-gild/10 px-3 py-2 text-xs text-nova-gild">
          This is your own account. {isRevokingAdmin ? "You will lose admin access immediately." : "You are changing your own role."}
        </p>
      )}
      {isGrantingAdmin && !isSelf && (
        <p className="mt-3 rounded-md border border-nova-gild/40 bg-nova-gild/10 px-3 py-2 text-xs text-nova-gild">
          This grants full admin access, including the ability to manage other users&apos; roles.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-nova-blood">{error}</p>}

      <AdminDialogFooter
        onCancel={onCancel}
        onConfirm={handleConfirm}
        isSubmitting={isSubmitting}
        confirmVariant="primary"
        confirmLabel="Confirm"
        confirmingLabel="Saving…"
      />
    </AdminModal>
  );
}
