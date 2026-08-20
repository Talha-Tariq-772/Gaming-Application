import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/src/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, getResponse } = createMiddlewareClient(request);
  const pathname = request.nextUrl.pathname;

  const isAdminPath = pathname.startsWith("/admin");
  const isAccountPath = pathname.startsWith("/account");
  const isLibraryPath = pathname.startsWith("/library");
  const isCheckoutPath = pathname.startsWith("/checkout");
  const isCompleteProfilePath = pathname === "/complete-profile";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated: /account, /library, and /admin force sign-in outright.
  // /complete-profile only makes sense with a session too. /checkout stays
  // reachable — the page itself already handles "no user".
  if (!user && (isAdminPath || isAccountPath || isLibraryPath || isCompleteProfilePath)) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (user) {
    // Role/phone re-checked from the DB here, server-side, on every
    // request — never trusted from a client value.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, phone_number")
      .eq("id", user.id)
      .single();

    if (isAdminPath && profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const needsPhone = !profile?.phone_number;

    if (needsPhone && (isAccountPath || isLibraryPath || isCheckoutPath)) {
      const completeUrl = new URL("/complete-profile", request.url);
      if (pathname !== "/complete-profile") completeUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(completeUrl);
    }

    if (!needsPhone && isCompleteProfilePath) {
      return NextResponse.redirect(new URL("/account", request.url));
    }
  }

  const response = getResponse();
  if (isAdminPath || isAccountPath || isLibraryPath || isCheckoutPath || isCompleteProfilePath) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/library/:path*", "/checkout/:path*", "/complete-profile"],
};
