import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";
import { createClient as createSessionClient } from "@/src/lib/supabase/server-session";

/**
 * TEST-ONLY. Establishes a real, cookie-backed session for a dedicated
 * admin test fixture account (never a real person's account) so an
 * automated test runner (Playwright, etc.) can verify admin-only UI —
 * layout, scroll behavior, anything middleware.ts gates behind a real
 * admin session — against a genuine authenticated session instead of
 * code-reading alone. This exists because the admin sidebar/scroll fix
 * (SmoothScrollProvider's /admin exclusion) was reported twice without
 * ever being exercised against a real session: there was previously no
 * way to authenticate as admin in an automated/agent environment at all.
 *
 * DOUBLE-gated, and both checks are load-bearing — never add a third way
 * to reach this that skips either one:
 *
 *   1. `process.env.NODE_ENV === "production"` -> 404, unconditionally,
 *      before anything else runs (no DB call, no auth call). This app's
 *      actual production run is `next build && next start`, which always
 *      sets NODE_ENV=production, so this branch alone should already make
 *      the route unreachable there.
 *   2. TEST_AUTH_SECRET must be set in the environment AND match the
 *      request's `secret` query param, even outside production. This is
 *      the real backstop: NODE_ENV is not a trustworthy gate on every
 *      hosting setup (a preview/staging deploy can still run in
 *      "production" mode, or a platform's env handling could be
 *      misconfigured) — TEST_AUTH_SECRET is meant to exist ONLY in a local
 *      .env.local, never in any deployed environment's config, so even a
 *      copy of this route that somehow reached a real deployment refuses
 *      every request with no secret configured (missing secret means
 *      "refuse", not "allow").
 *
 * Both checks return a bare 404 with no body — identical to a route that
 * doesn't exist — never a 401/403 that would confirm the route's presence
 * to a prober.
 */

const TEST_ADMIN_EMAIL = "playwright-admin@test.pscbundle.local";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const configuredSecret = process.env.TEST_AUTH_SECRET;
  const providedSecret = request.nextUrl.searchParams.get("secret");
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return new NextResponse(null, { status: 404 });
  }

  const service = createServiceClient();

  // `generateLink` with type "magiclink" creates the user if it doesn't
  // already exist yet (Supabase's documented admin-API behavior) and
  // returns a hashed_token that can be redeemed for a real session below —
  // idempotent across repeated test runs, and never touches any other
  // account by construction (fixed email, not caller-supplied).
  const { data, error } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_ADMIN_EMAIL,
  });
  if (error || !data.user || !data.properties?.hashed_token) {
    return NextResponse.json(
      { error: error?.message ?? "failed to provision the test admin session" },
      { status: 500 },
    );
  }

  // Always re-assert admin role rather than trusting it was set once —
  // handle_new_user (supabase/migrations) defaults every new profile to
  // 'customer', so a first-ever call for this fixture account would
  // otherwise sign in as a non-admin and immediately bounce off
  // middleware.ts's isAdminPath check.
  const { error: roleError } = await service
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", data.user.id);
  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 500 });
  }

  // The cookie-writing session client (not the service client above) —
  // verifyOtp here is what actually sets the real sb-*-auth-token cookies
  // on the response, the same way a normal magic-link click would.
  const session = await createSessionClient();
  const { error: verifyError } = await session.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 });
  }

  const nextPath = request.nextUrl.searchParams.get("next") ?? "/admin/orders";
  return NextResponse.redirect(new URL(nextPath, request.url));
}
