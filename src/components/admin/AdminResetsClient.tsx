"use client";

import { useState } from "react";
import AdminButton from "@/src/components/admin/AdminButton";
import AdminTable from "@/src/components/admin/AdminTable";
import PasswordResetDialog from "@/src/components/admin/PasswordResetDialog";
import type { PasswordResetRequest } from "@/src/lib/actions/admin-resets";
import { formatDateTime } from "@/src/lib/date";

export default function AdminResetsClient({ requests: initialRequests }: { requests: PasswordResetRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [selected, setSelected] = useState<PasswordResetRequest | null>(null);

  function handleReset(profileId: string) {
    setRequests((prev) => prev.filter((r) => r.profileId !== profileId));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-bold text-nova-bone">Password Reset Requests</h1>
        <p className="mt-1 text-sm text-nova-ash">
          Customers with no recovery email land here — verify identity against recent orders before resetting.
        </p>
      </div>

      <AdminTable
        columns={[
          { key: "name", header: "Customer", render: (r: PasswordResetRequest) => r.fullName ?? "Unnamed" },
          { key: "phone", header: "Phone", mono: true, render: (r: PasswordResetRequest) => r.phoneNumber ?? "—" },
          { key: "requested", header: "Requested", render: (r: PasswordResetRequest) => formatDateTime(r.requestedAt) },
          {
            key: "action",
            header: <span className="sr-only">Action</span>,
            align: "right",
            render: (r: PasswordResetRequest) => (
              <AdminButton variant="primary" onClick={() => setSelected(r)}>
                Verify &amp; reset
              </AdminButton>
            ),
          },
        ]}
        rows={requests}
        rowKey={(r) => r.profileId}
        emptyMessage="No pending password reset requests."
        renderMobileCard={(r) => (
          <div className="rounded-lg border border-nova-hairline bg-nova-crypt p-4">
            <p className="font-semibold text-nova-bone">{r.fullName ?? "Unnamed"}</p>
            <p className="font-mono text-sm text-nova-ash">{r.phoneNumber}</p>
            <p className="mt-1 text-xs text-nova-smoke">Requested {formatDateTime(r.requestedAt)}</p>
            <AdminButton variant="primary" className="mt-3 w-full" onClick={() => setSelected(r)}>
              Verify &amp; reset
            </AdminButton>
          </div>
        )}
      />

      {selected && (
        <PasswordResetDialog request={selected} onClose={() => setSelected(null)} onReset={handleReset} />
      )}
    </div>
  );
}
