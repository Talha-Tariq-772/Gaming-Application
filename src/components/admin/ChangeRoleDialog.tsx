"use client";

import { useRef, useState } from "react";
import { useFocusTrap } from "@/src/lib/use-focus-trap";
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
  const panelRef = useFocusTrap<HTMLDivElement>(true, onCancel);

  function handleConfirm() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    onConfirm();
  }

  const isGrantingAdmin = newRole === "admin";
  const isRevokingAdmin = profile.role === "admin" && newRole !== "admin";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div onClick={onCancel} aria-hidden="true" className="absolute inset-0 bg-nova-void/80" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirm role change"
        className="relative w-full max-w-sm rounded-lg border border-nova-hairline bg-nova-crypt p-6"
      >
        <h2 className="text-lg font-bold text-nova-bone">Change role?</h2>
        <p className="mt-3 text-sm text-nova-ash">
          Change <span className="font-medium text-nova-bone">{profile.email ?? profile.id}</span> from{" "}
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
            className="min-h-11 flex-1 rounded-md bg-nova-ember-lo px-4 py-2 text-sm font-semibold text-nova-bone transition-colors duration-(--duration-fast) ease-standard hover:bg-nova-ember-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
