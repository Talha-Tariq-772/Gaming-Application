import { NextResponse, type NextRequest } from "next/server";
import { resolvePostLoginRedirect, type PostLoginProfile } from "@/src/lib/auth/post-login-redirect";
import { createClient } from "@/src/lib/supabase/server-session";

/**
 * OAuth redirect target. Route Handlers (unlike plain Server Component
 * rendering) can read AND write cookies, so exchangeCodeForSession here
 * actually persists the resulting session.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/account";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let profile: PostLoginProfile | null = null;
      if (user) {
        const { data } = await supabase.from("profiles").select("phone_number, role").eq("id", user.id).single();
        profile = data;
      }

      return NextResponse.redirect(resolvePostLoginRedirect(origin, next, profile));
    }

    console.error("[auth/callback] exchangeCodeForSession", error);
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth`);
}
