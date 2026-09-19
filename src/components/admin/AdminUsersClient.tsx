"use client";

import { useMemo, useState } from "react";
import AdminTable, { type AdminTableColumn } from "@/src/components/admin/AdminTable";
import ChangeRoleDialog from "@/src/components/admin/ChangeRoleDialog";
import DeleteUserDialog from "@/src/components/admin/DeleteUserDialog";
import { changeUserRole, deleteUser, previewUserDeletion } from "@/src/lib/actions/admin-users";
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
      // A deleted account can never sign in again — changing its role has
      // no effect a real session could ever observe, so this stays
      // disabled regardless of canChangeRoles once deletedAt is set.
      disabled={!canChangeRoles || profile.deletedAt !== null}
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

/**
 * Row-level Delete affordance — same denser text-button shape GamesTable's
 * RowActions uses (text-nova-blood), not AdminButton's solid destructive
 * variant (that's reserved for the confirmation dialog's own footer, per
 * AdminButton's own doc comment: row actions are deliberately a distinct,
 * lighter-weight affordance).
 *
 * Hidden entirely (not just disabled) for the signed-in admin's own row —
 * self-delete is blocked server-side too (deleteUser, admin-users.ts), but
 * there's no scenario where showing a button that always fails is useful,
 * unlike RoleSelect's self-change which stays a real, allowed action.
 * Already-deleted rows get a static label instead of a live control.
 */
function DeleteAction({
  profile,
  isSelf,
  canDelete,
  onRequestDelete,
}: {
  profile: Profile;
  isSelf: boolean;
  canDelete: boolean;
  onRequestDelete: (profile: Profile) => void;
}) {
  if (isSelf || !canDelete) return null;
  if (profile.deletedAt !== null) {
    return <span className="text-xs font-medium text-nova-smoke">Deleted</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onRequestDelete(profile)}
      className="-my-3 flex min-h-11 min-w-11 items-center justify-center px-2 text-xs font-semibold text-nova-blood hover:text-nova-blood/80"
    >
      Delete
    </button>
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
  const [pendingDelete, setPendingDelete] = useState<Profile | null>(null);
  const [deletePreview, setDeletePreview] = useState<{ orderCount: number; willHardDelete: boolean } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  // Opens the dialog immediately (isLoadingPreview shows a "Checking order
  // history…" placeholder) rather than waiting on the network round trip
  // first — previewUserDeletion is read-only and best-effort, same
  // "hint the server re-derives for real" relationship deleteGame's
  // willHardDelete check has to its own dialog.
  function requestDelete(profile: Profile) {
    setDeleteError(null);
    setDeletePreview(null);
    setPendingDelete(profile);
    previewUserDeletion(profile.id).then((result) => {
      if (!result.ok) {
        setDeleteError(result.message);
        return;
      }
      setDeletePreview({ orderCount: result.orderCount, willHardDelete: result.willHardDelete });
    });
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleteError(null);
    const result = await deleteUser(pendingDelete.id, currentUserId);
    if (!result.ok) {
      setDeleteError(result.message);
      return;
    }
    const identifier = isSyntheticAuthEmail(pendingDelete.email)
      ? pendingDelete.phoneNumber ?? "User"
      : pendingDelete.email ?? "User";
    if (result.hardDeleted) {
      setProfiles((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      showToast(`${identifier} deleted`);
    } else {
      setProfiles((prev) =>
        prev.map((p) => (p.id === pendingDelete.id ? { ...p, deletedAt: new Date().toISOString() } : p)),
      );
      showToast(`${identifier} deactivated`);
    }
    setPendingDelete(null);
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
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border border-nova-hairline bg-nova-slab px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-nova-ash">
            {p.role}
          </span>
          {p.deletedAt !== null && (
            <span className="inline-flex items-center rounded-full border border-nova-blood/40 bg-nova-blood/10 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-nova-blood">
              Deleted
            </span>
          )}
        </div>
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
    {
      key: "delete",
      header: <span className="sr-only">Delete</span>,
      align: "right",
      render: (p) => (
        <div className="flex justify-end">
          <DeleteAction
            profile={p}
            isSelf={p.id === currentUserId}
            // Delete is gated the same strict-admin (not agent) permission
            // as role changes — canChangeRoles is really "caller is a real
            // admin, not just an agent," reused here rather than adding an
            // identical second prop for the same check.
            canDelete={canChangeRoles}
            onRequestDelete={requestDelete}
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
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="inline-flex items-center rounded-full border border-nova-hairline bg-nova-slab px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-nova-ash">
                  {profile.role}
                </span>
                {profile.deletedAt !== null && (
                  <span className="inline-flex items-center rounded-full border border-nova-blood/40 bg-nova-blood/10 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-nova-blood">
                    Deleted
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-nova-hairline pt-3 text-xs text-nova-ash">
              <span>{profile.phoneNumber ?? "No phone"}</span>
              <span>Joined {formatJoined(profile.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <RoleSelect
                profile={profile}
                canChangeRoles={canChangeRoles}
                onRequestChange={(newRole) => requestChange(profile, newRole)}
                className="min-h-11 flex-1 rounded-md border border-nova-hairline bg-nova-slab px-2 py-1.5 text-sm font-semibold text-nova-bone focus:border-nova-ember focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              />
              <DeleteAction
                profile={profile}
                isSelf={profile.id === currentUserId}
                canDelete={canChangeRoles}
                onRequestDelete={requestDelete}
              />
            </div>
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

      {pendingDelete && (
        <DeleteUserDialog
          profile={pendingDelete}
          orderCount={deletePreview?.orderCount ?? null}
          willHardDelete={deletePreview?.willHardDelete ?? null}
          error={deleteError}
          onCancel={() => {
            setPendingDelete(null);
            setDeletePreview(null);
            setDeleteError(null);
          }}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
