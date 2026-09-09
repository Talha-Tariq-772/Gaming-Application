"use client";

import { useEffect, useRef, useState } from "react";
import AdminButton from "@/src/components/admin/AdminButton";
import AdminModal, { AdminDialogFooter } from "@/src/components/admin/AdminModal";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  getRecentOrdersForProfile,
  manualPasswordReset,
  type PasswordResetRequest,
  type RecentOrderSummary,
} from "@/src/lib/actions/admin-resets";
import { formatDateTime } from "@/src/lib/date";
import { formatPriceExact } from "@/src/lib/format";

/**
 * Verify-then-reset flow: recent order details load first so the admin can
 * cross-check the requester's story (matches how they'd normally confirm
 * identity over WhatsApp) before the Reset button is even enabled. The
 * generated password is shown exactly once, immediately after reset —
 * same "shown once, relay it yourself" shape as CredentialReveal — since
 * this app never emails or texts secrets on its own; the admin relays it
 * over WhatsApp after this dialog closes.
 */
export default function PasswordResetDialog({
  request,
  onClose,
  onReset,
}: {
  request: PasswordResetRequest;
  onClose: () => void;
  onReset: (profileId: string) => void;
}) {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<RecentOrderSummary[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getRecentOrdersForProfile(request.profileId).then((data) => {
      if (!cancelled) setOrders(data);
    });
    return () => {
      cancelled = true;
    };
  }, [request.profileId]);

  async function handleConfirm() {
    if (submittingRef.current || !profile) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    const result = await manualPasswordReset(request.profileId, profile.id);
    setIsSubmitting(false);
    submittingRef.current = false;

    if (!result.ok) {
      setError(result.message);
      return;
    }
    setTemporaryPassword(result.temporaryPassword);
    onReset(request.profileId);
  }

  if (temporaryPassword) {
    return (
      <AdminModal onCancel={onClose} ariaLabel="New temporary password">
        <h2 className="text-lg font-bold text-nova-bone">Password reset</h2>
        <p className="mt-3 text-sm text-nova-ash">
          Relay this password to the customer over WhatsApp now — it won&rsquo;t be shown again.
        </p>
        <p className="mt-3 rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 text-center font-mono text-lg text-nova-bone">
          {temporaryPassword}
        </p>
        <div className="mt-6">
          <AdminButton variant="primary" className="w-full" onClick={onClose}>
            Done
          </AdminButton>
        </div>
      </AdminModal>
    );
  }

  return (
    <AdminModal onCancel={onClose} ariaLabel="Verify and reset password">
      <h2 className="text-lg font-bold text-nova-bone">{request.fullName ?? "Unnamed customer"}</h2>
      <p className="mt-1 font-mono text-sm text-nova-smoke">{request.phoneNumber}</p>
      <p className="mt-1 text-xs text-nova-smoke">Requested {formatDateTime(request.requestedAt)}</p>

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-nova-smoke">Recent orders</h3>
      <div className="mt-2 flex flex-col gap-2">
        {orders === null && <p className="text-sm text-nova-ash">Loading…</p>}
        {orders?.length === 0 && <p className="text-sm text-nova-ash">No orders on this account.</p>}
        {orders?.map((order) => (
          <div key={order.id} className="flex items-center justify-between rounded-md border border-nova-hairline px-3 py-2 text-sm">
            <div>
              <p className="font-mono text-nova-bone">{order.paymentReference}</p>
              <p className="text-xs text-nova-smoke">{formatDateTime(order.createdAt)}</p>
            </div>
            <div className="text-right">
              <p className="text-nova-bone">{formatPriceExact(order.amountExact)}</p>
              <p className="text-xs text-nova-smoke">{order.status}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-nova-ash">
        Confirm the customer&rsquo;s identity against these details before resetting — this generates a new
        password immediately.
      </p>

      {error && <p className="mt-3 text-sm text-nova-blood">{error}</p>}

      <AdminDialogFooter
        onCancel={onClose}
        onConfirm={handleConfirm}
        isSubmitting={isSubmitting}
        confirmVariant="primary"
        confirmLabel="Reset password"
        confirmingLabel="Resetting…"
      />
    </AdminModal>
  );
}
