"use client";

import { useMemo, useState } from "react";
import ChangeRoleDialog from "@/src/components/admin/ChangeRoleDialog";
import { changeUserRole } from "@/src/lib/actions/admin-users";
import { useToastStore } from "@/src/stores/toast-store";
import type { Profile, ProfileRole } from "@/src/types/database";

const ROLES: ProfileRole[] = ["customer", "agent", "admin"];

function formatJoined(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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
        (p.email ?? "").toLowerCase().includes(q) ||
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
    showToast(`${pendingChange.profile.email ?? "User"} is now ${result.newRole}`);
    setPendingChange(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-nova-bone">Users</h1>
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

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-nova-hairline bg-nova-crypt px-4 py-12 text-center text-sm text-nova-ash">
          No users match your search.
        </div>
      ) : (
        <>
          {/* Table — md and up */}
          <div className="hidden overflow-x-auto rounded-lg border border-nova-hairline md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-nova-hairline bg-nova-crypt text-xs uppercase tracking-wider text-nova-smoke">
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Change role</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((profile) => (
                  <tr key={profile.id} className="border-b border-nova-hairline last:border-b-0">
                    <td className="px-4 py-3 font-medium text-nova-bone">{profile.email ?? "—"}</td>
                    <td className="px-4 py-3 text-nova-ash">{profile.fullName ?? "—"}</td>
                    <td className="px-4 py-3 text-nova-ash">{profile.phoneNumber ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border border-nova-hairline bg-nova-slab px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-nova-ash">
                        {profile.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-nova-smoke">{formatJoined(profile.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <select
                        aria-label={`Change role for ${profile.email ?? profile.id}`}
                        value={profile.role}
                        disabled={!canChangeRoles}
                        onChange={(e) => {
                          const newRole = e.target.value as ProfileRole;
                          if (newRole === profile.role) return;
                          setDialogError(null);
                          setPendingChange({ profile, newRole });
                        }}
                        className="min-h-11 rounded-md border border-nova-hairline bg-nova-slab px-2 py-1.5 text-xs font-semibold text-nova-bone focus:border-nova-ember focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stacked cards — below md */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((profile) => (
              <div key={profile.id} className="flex flex-col gap-3 rounded-lg border border-nova-hairline bg-nova-void p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-nova-bone">{profile.email ?? "—"}</p>
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
                <select
                  aria-label={`Change role for ${profile.email ?? profile.id}`}
                  value={profile.role}
                  disabled={!canChangeRoles}
                  onChange={(e) => {
                    const newRole = e.target.value as ProfileRole;
                    if (newRole === profile.role) return;
                    setDialogError(null);
                    setPendingChange({ profile, newRole });
                  }}
                  className="min-h-11 w-full rounded-md border border-nova-hairline bg-nova-slab px-2 py-1.5 text-sm font-semibold text-nova-bone focus:border-nova-ember focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </>
      )}

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
