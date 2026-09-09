"use client";

import { useMemo, useState } from "react";
import AdminTable, { type AdminTableColumn } from "@/src/components/admin/AdminTable";
import ChangeRoleDialog from "@/src/components/admin/ChangeRoleDialog";
import { changeUserRole } from "@/src/lib/actions/admin-users";
import { isSyntheticAuthEmail } from "@/src/lib/phone";
import { useToastStore } from "@/src/stores/toast-store";
import type { Profile, ProfileRole } from "@/src/types/database";

const ROLES: ProfileRole[] = ["customer", "agent", "admin"];

function formatJoined(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function RoleSelect({
  profile,
  canChangeRoles,
  onRequestChange,
  className,
}: {
  profile: Profile;
  canChangeRoles: boolean;
  onRequestChange: (newRole: ProfileRole) => void;
  className: string;
}) {
  const identifier = isSyntheticAuthEmail(profile.email)
    ? profile.phoneNumber ?? profile.id
    : profile.email ?? profile.id;

  return (
    <select
      aria-label={`Change role for ${identifier}`}
      value={profile.role}
      disabled={!canChangeRoles}
      onChange={(e) => {
        const newRole = e.target.value as ProfileRole;
        if (newRole === profile.role) return;
        onRequestChange(newRole);
      }}
      className={className}
    >
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </select>
  );
}

export default function AdminUsersClient({
  initialProfiles,
  currentUserId,
  canChangeRoles,
}: {
  initialProfiles: Profile[];
  currentUserId: string;
  canChangeRoles: boolean;
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [search, setSearch] = useState("");
  const [pendingChange, setPendingChange] = useState<{ profile: Profile; newRole: ProfileRole } | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const showToast = useToastStore((s) => s.showToast);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        (!isSyntheticAuthEmail(p.email) && (p.email ?? "").toLowerCase().includes(q)) ||
        (p.fullName ?? "").toLowerCase().includes(q) ||
        (p.phoneNumber ?? "").toLowerCase().includes(q),
    );
  }, [profiles, search]);

  async function handleConfirmChange() {
    if (!pendingChange) return;
    setDialogError(null);
    const result = await changeUserRole(pendingChange.profile.id, pendingChange.newRole, currentUserId);
    if (!result.ok) {
      setDialogError(result.message);
      return;
    }
    setProfiles((prev) =>
      prev.map((p) => (p.id === pendingChange.profile.id ? { ...p, role: result.newRole } : p)),
    );
    const identifier = isSyntheticAuthEmail(pendingChange.profile.email)
      ? pendingChange.profile.phoneNumber ?? "User"
      : pendingChange.profile.email ?? "User";
    showToast(`${identifier} is now ${result.newRole}`);
    setPendingChange(null);
  }

  function requestChange(profile: Profile, newRole: ProfileRole) {
    setDialogError(null);
    setPendingChange({ profile, newRole });
  }

  const columns: AdminTableColumn<Profile>[] = [
    {
      key: "email",
      header: "Email",
      render: (p) => (
        <span className="font-medium text-nova-bone">
          {isSyntheticAuthEmail(p.email) ? "—" : (p.email ?? "—")}
        </span>
      ),
    },
    { key: "name", header: "Name", render: (p) => <span className="text-nova-ash">{p.fullName ?? "—"}</span> },
    { key: "phone", header: "Phone", render: (p) => <span className="text-nova-ash">{p.phoneNumber ?? "—"}</span> },
    {
      key: "role",
      header: "Role",
      render: (p) => (
        <span className="inline-flex items-center rounded-full border border-nova-hairline bg-nova-slab px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-nova-ash">
          {p.role}
        </span>
      ),
    },
    { key: "joined", header: "Joined", render: (p) => <span className="text-nova-smoke">{formatJoined(p.createdAt)}</span> },
    {
      key: "change-role",
      header: <span className="sr-only">Change role</span>,
      align: "right",
      render: (p) => (
        <div className="flex justify-end">
          <RoleSelect
            profile={p}
            canChangeRoles={canChangeRoles}
            onRequestChange={(newRole) => requestChange(p, newRole)}
            className="min-h-11 rounded-md border border-nova-hairline bg-nova-slab px-2 py-1.5 text-xs font-semibold text-nova-bone focus:border-nova-ember focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-bold text-nova-bone">Users</h1>
        <p className="mt-1 text-sm text-nova-ash">{profiles.length} total</p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by email, name, or phone…"
        aria-label="Search users"
        className="min-h-11 w-full max-w-xs rounded-md border border-nova-hairline bg-nova-crypt px-3 py-2 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
      />

      <AdminTable
        columns={columns}
        rows={filtered}
        rowKey={(p) => p.id}
        emptyMessage="No users match your search."
        renderMobileCard={(profile) => (
          <div className="flex flex-col gap-3 rounded-lg border border-nova-hairline bg-nova-void p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-nova-bone">
                  {isSyntheticAuthEmail(profile.email) ? "—" : (profile.email ?? "—")}
                </p>
                <p className="truncate text-xs text-nova-smoke">{profile.fullName ?? "—"}</p>
              </div>
              <span className="inline-flex shrink-0 items-center rounded-full border border-nova-hairline bg-nova-slab px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-nova-ash">
                {profile.role}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-nova-hairline pt-3 text-xs text-nova-ash">
              <span>{profile.phoneNumber ?? "No phone"}</span>
              <span>Joined {formatJoined(profile.createdAt)}</span>
            </div>
            <RoleSelect
              profile={profile}
              canChangeRoles={canChangeRoles}
              onRequestChange={(newRole) => requestChange(profile, newRole)}
              className="min-h-11 w-full rounded-md border border-nova-hairline bg-nova-slab px-2 py-1.5 text-sm font-semibold text-nova-bone focus:border-nova-ember focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            />
          </div>
        )}
      />

      {pendingChange && (
        <ChangeRoleDialog
          profile={pendingChange.profile}
          newRole={pendingChange.newRole}
          isSelf={pendingChange.profile.id === currentUserId}
          error={dialogError}
          onCancel={() => {
            setPendingChange(null);
            setDialogError(null);
          }}
          onConfirm={handleConfirmChange}
        />
      )}
    </div>
  );
}
