import Link from "next/link";
import type { ReactNode } from "react";
import CartTriggerButton from "@/src/components/cart/CartTriggerButton";
import HeaderAuthMenu from "@/src/components/HeaderAuthMenu";
import HeaderNav from "@/src/components/HeaderNav";
import MobileNav, { type MobileAuthState } from "@/src/components/MobileNav";
import ThemeToggle from "@/src/components/ThemeToggle";
import { isSyntheticAuthEmail } from "@/src/lib/phone";
import { createClient } from "@/src/lib/supabase/server-session";
import Button from "./Button";

/**
 * Reads the session server-side (not a client-side auth check) — this is
 * why every page rendering Header (the whole (storefront) route group) is
 * now dynamically rendered rather than statically prerendered: reading
 * cookies() opts a route out of static generation. That's an inherent
 * trade of build-time caching for a header that's actually correct on
 * first paint, not a mistake.
 */
export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let authSlot: ReactNode;
  let mobileAuth: MobileAuthState;

  if (!user) {
    authSlot = (
      <Button as="a" href="/sign-in" variant="secondary" className="text-xs">
        Sign In
      </Button>
    );
    mobileAuth = { status: "signed-out" };
  } else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone_number, role")
      .eq("id", user.id)
      .single();

    if (!profile?.phone_number) {
      authSlot = (
        <Link
          href="/complete-profile"
          className="-my-2 flex min-h-11 items-center py-2 text-xs font-semibold uppercase tracking-wider text-nova-gild hover:text-nova-gild/80"
        >
          Complete your profile
        </Link>
      );
      mobileAuth = { status: "needs-profile" };
    } else {
      // Read straight from the Google session's own metadata rather than
      // our profiles table — profiles.full_name is only ever set once, at
      // signup, and never kept in sync afterward. phone_number comes
      // before user.email in this fallback chain, and user.email is
      // skipped entirely for a phone+password account (its auth.users
      // email is the synthetic "@phone.pscbundle.local" address — see
      // src/lib/phone.ts's phoneToAuthEmail — which must never reach the
      // UI) — profiles.phone_number (already fetched above) is what's
      // shown instead.
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const realEmail = isSyntheticAuthEmail(user.email) ? undefined : user.email;
      const name =
        (meta.full_name as string | undefined) ||
        (meta.name as string | undefined) ||
        realEmail ||
        profile.phone_number ||
        "Account";
      const avatarUrl =
        (meta.avatar_url as string | undefined) || (meta.picture as string | undefined) || null;
      const isStaff = profile.role === "admin" || profile.role === "agent";

      authSlot = <HeaderAuthMenu name={name} avatarUrl={avatarUrl} isStaff={isStaff} />;
      mobileAuth = { status: "signed-in", name, avatarUrl, isStaff };
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-nova-hairline bg-nova-void/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-page items-center justify-between px-4 py-3 md:px-8">
        <HeaderNav />

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <CartTriggerButton />
          {/* Below md, auth moves into MobileNav's panel instead (its own
              "Sign In" full-width CTA, or the signed-in Account/Admin/Sign
              Out rows) — there's no room left in the bar once the
              hamburger sits here too, and the panel already has to carry
              this content regardless. */}
          <div className="hidden md:block">{authSlot}</div>
          <MobileNav mobileAuth={mobileAuth} />
        </div>
      </div>
    </header>
  );
}
