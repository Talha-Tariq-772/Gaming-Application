import Link from "next/link";
import type { ReactNode } from "react";
import CartTriggerButton from "@/src/components/cart/CartTriggerButton";
import HeaderAuthMenu from "@/src/components/HeaderAuthMenu";
import HeaderNav from "@/src/components/HeaderNav";
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

  if (!user) {
    authSlot = (
      <Button as="a" href="/sign-in" variant="secondary" className="text-xs">
        Sign In
      </Button>
    );
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
    } else {
      // Read straight from the Google session's own metadata rather than
      // our profiles table — profiles.full_name is only ever set once, at
      // signup, and never kept in sync afterward.
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const name =
        (meta.full_name as string | undefined) ||
        (meta.name as string | undefined) ||
        user.email ||
        "Account";
      const avatarUrl =
        (meta.avatar_url as string | undefined) || (meta.picture as string | undefined) || null;
      const isStaff = profile.role === "admin" || profile.role === "agent";

      authSlot = <HeaderAuthMenu name={name} avatarUrl={avatarUrl} isStaff={isStaff} />;
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-nova-hairline bg-nova-void/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-page items-center justify-between px-4 py-3 md:px-8">
        <HeaderNav />

        <div className="flex items-center gap-4">
          <CartTriggerButton />
          {authSlot}
        </div>
      </div>
    </header>
  );
}
