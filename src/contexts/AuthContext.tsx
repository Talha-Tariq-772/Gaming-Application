"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/src/lib/supabase/client";
import { useCartStore } from "@/src/stores/cart-store";
import type { Profile } from "@/src/types/database";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProfileRow(row: any): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    phoneVerified: row.phone_verified,
    role: row.role,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function loadProfile(currentUser: User | null) {
      if (!currentUser) {
        if (!cancelled) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone_number, phone_verified, role, created_at, deleted_at")
        .eq("id", currentUser.id)
        .single();
      if (!cancelled) {
        setUser(currentUser);
        setProfile(data ? mapProfileRow(data) : null);
        setLoading(false);
      }
    }

    supabase.auth.getUser().then(({ data: { user: initialUser } }) => loadProfile(initialUser));

    // Cart-leak prevention on a shared device (cart-store.ts's own comment
    // has the full rules) — SIGNED_OUT is a secondary safety net here, NOT
    // the primary mechanism. This app's only sign-out button
    // (signOutAndClearCart, src/lib/actions/sign-out-client.ts) goes
    // through a Server Action that clears the session cookie server-side
    // and redirects, which never touches this BROWSER client, so this
    // listener does not reliably observe a SIGNED_OUT event for it —
    // confirmed empirically. Kept anyway for the case Supabase's own
    // client fires SIGNED_OUT on its own (e.g. a background token refresh
    // discovering the refresh token is genuinely invalid).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      loadProfile(session?.user ?? null);
      if (event === "SIGNED_OUT") {
        useCartStore.getState().clearOnSignOut();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Re-verifies the cart's owner tag against whoever the session cookie
  // ACTUALLY says right now, on every route change — not only on auth
  // *events*. Every sign-in flow in this app (signUpWithPhone,
  // signInWithPhone) is a Server Action + redirect(), the same shape as
  // signOut() above, and it has the identical gap: the browser Supabase
  // client never itself performs the sign-in, so onAuthStateChange's
  // SIGNED_IN never reliably fires for it either — confirmed empirically
  // by switching from account D straight to account C via /login (no
  // explicit sign-out in between): the session cookie was already C's,
  // but the cart stayed tagged to D until this effect was added. A fresh
  // getUser() call — a real network/local-JWT check, not a cached React
  // value — is what makes this correct regardless of how the navigation
  // that brought us to this pathname actually happened (hard or soft).
  // Skipped entirely when signed out (claimForUser only ever runs with a
  // real user id), so a guest's own cart is never touched here.
  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data: { user: currentUser } }) => {
        if (cancelled || !currentUser) return;
        useCartStore.getState().claimForUser(currentUser.id);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return <AuthContext.Provider value={{ user, profile, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
