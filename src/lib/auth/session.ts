import "server-only";

import { createClient as createSessionClient } from "@/src/lib/supabase/server-session";
import type { ProfileRole } from "@/src/types/database";

export interface AuthenticatedProfile {
  id: string;
  role: ProfileRole;
  fullName: string | null;
  phoneNumber: string | null;
}

/**
 * The verified identity of whoever is actually calling — derived from the
 * request's session cookie via Supabase Auth (getUser() re-validates the
 * JWT against the auth server, unlike getSession()), never from a
 * client-supplied id. Server actions must use this, not their own
 * userId/adminId parameters, for any authorization decision.
 */
export async function getAuthenticatedProfile(): Promise<AuthenticatedProfile | null> {
  const supabase = await createSessionClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return null;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone_number")
    .eq("id", user.id)
    .single();
  if (profileErr || !profile) return null;

  return {
    id: profile.id,
    role: profile.role as ProfileRole,
    fullName: profile.full_name,
    phoneNumber: profile.phone_number,
  };
}

export class UnauthorizedError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Throws unless the caller's real session belongs to exactly this user id. */
export async function requireUser(expectedUserId: string): Promise<AuthenticatedProfile> {
  const profile = await getAuthenticatedProfile();
  if (!profile) throw new UnauthorizedError();
  if (profile.id !== expectedUserId) throw new ForbiddenError("Session does not match the given user");
  return profile;
}

/** Throws unless there's a real logged-in session — for actions with no id of their own to cross-check. */
export async function requireAuthenticated(): Promise<AuthenticatedProfile> {
  const profile = await getAuthenticatedProfile();
  if (!profile) throw new UnauthorizedError();
  return profile;
}

/** Throws unless the caller's real session is admin (or agent, when allowed). */
export async function requireAdmin(options?: { allowAgent?: boolean }): Promise<AuthenticatedProfile> {
  const profile = await getAuthenticatedProfile();
  if (!profile) throw new UnauthorizedError();
  const allowedRoles: ProfileRole[] = options?.allowAgent ? ["admin", "agent"] : ["admin"];
  if (!allowedRoles.includes(profile.role)) throw new ForbiddenError("Admin role required");
  return profile;
}
