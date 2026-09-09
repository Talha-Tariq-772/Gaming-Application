"use client";

import type { ReactNode } from "react";
import AdminButton, { type AdminButtonVariant } from "@/src/components/admin/AdminButton";
import { useFocusTrap } from "@/src/lib/use-focus-trap";

/**
 * Centered-modal shell shared by every admin confirm/form dialog
 * (Approve, Reject, ChangeRole, DeleteGame, GameForm). Owns the backdrop,
 * focus trap (and therefore scroll lock), and the panel chrome — the
 * caller supplies its own fields/copy as children plus an optional
 * footer via <AdminDialogFooter>.
 */
export default function AdminModal({
  onCancel,
  ariaLabel,
  role = "dialog",
  maxWidth = "max-w-sm",
  children,
}: {
  onCancel: () => void;
  ariaLabel: string;
  role?: "dialog" | "alertdialog";
  maxWidth?: string;
  children: ReactNode;
}) {
  const panelRef = useFocusTrap<HTMLDivElement>(true, onCancel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div onClick={onCancel} aria-hidden="true" className="absolute inset-0 bg-nova-void/80" />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        className={`relative flex max-h-full w-full ${maxWidth} flex-col overflow-y-auto rounded-lg border border-nova-hairline bg-nova-crypt p-6`}
      >
        {children}
      </div>
    </div>
  );
}

/** Cancel + Confirm footer — ember (primary) vs blood (destructive) is a
 * variant, not a separately-styled button per dialog. */
export function AdminDialogFooter({
  onCancel,
  cancelLabel = "Cancel",
  onConfirm,
  confirmType = "button",
  confirmVariant = "primary",
  confirmLabel,
  confirmingLabel,
  isSubmitting = false,
}: {
  onCancel: () => void;
  cancelLabel?: string;
  onConfirm?: () => void;
  confirmType?: "button" | "submit";
  confirmVariant?: AdminButtonVariant;
  confirmLabel: string;
  confirmingLabel?: string;
  isSubmitting?: boolean;
}) {
  return (
    <div className="mt-6 flex gap-3">
      <AdminButton variant="secondary" className="flex-1 font-medium" onClick={onCancel} disabled={isSubmitting}>
        {cancelLabel}
      </AdminButton>
      <AdminButton
        variant={confirmVariant}
        type={confirmType}
        className="flex-1"
        onClick={confirmType === "button" ? onConfirm : undefined}
        disabled={isSubmitting}
      >
        {isSubmitting && confirmingLabel ? confirmingLabel : confirmLabel}
      </AdminButton>
    </div>
  );
}
