import type { ProfileRole } from "@/src/types/database";

export interface PostLoginProfile {
  phone_number: string | null;
  role: ProfileRole;
}

/**
 * Pure redirect-target decision, pulled out of the callback route handler
 * so it's testable without a real Google-issued OAuth code
 * (exchangeCodeForSession can't be exercised outside a real browser flow —
 * this can). Also required to live outside route.ts: Next's route-type
 * checking rejects any named export from a route.ts file besides the HTTP
 * method handlers and a small allow-list of special exports.
 */
export function resolvePostLoginRedirect(origin: string, next: string, profile: PostLoginProfile | null): string {
  if (!profile?.phone_number) {
    const completeUrl = new URL("/complete-profile", origin);
    if (next !== "/complete-profile") completeUrl.searchParams.set("next", next);
    return completeUrl.toString();
  }

  // Staff land straight in the admin console on login, regardless of where
  // `next` pointed — a one-time login-moment routing choice, not a
  // standing rule. Middleware does NOT force this on every visit, so an
  // admin can still browse the storefront normally by navigating there
  // themselves afterward.
  if (profile.role === "admin" || profile.role === "agent") {
    return `${origin}/admin`;
  }

  return `${origin}${next}`;
}
