import type { ProfileRole } from "@/src/types/database";

/**
 * Pure decision function behind the last-admin guardrail, split out from
 * changeUserRole so it's testable without needing to actually drive a real
 * database's admin count down to zero. Lives outside admin-users.ts because
 * "use server" files may only export async functions.
 */
export function isLastAdminDemotion(
  oldRole: ProfileRole,
  newRole: ProfileRole,
  currentAdminCount: number,
): boolean {
  if (oldRole !== "admin" || newRole === "admin") return false;
  return currentAdminCount <= 1;
}
