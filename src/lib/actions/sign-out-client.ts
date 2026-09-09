"use client";

import { signOut } from "@/src/lib/actions/auth";
import { useCartStore } from "@/src/stores/cart-store";

/**
 * Every "Sign Out" control in the app must go through this, not signOut()
 * directly (AdminNav, HeaderAuthMenu, MobileNav all do).
 *
 * signOut() is a Server Action — it clears the session cookie server-side
 * and redirect()s, but never calls the BROWSER's own Supabase client, so
 * AuthContext's onAuthStateChange listener never actually observes a
 * SIGNED_OUT event for it. Confirmed empirically (not assumed): signing out
 * through the real UI left the previous account's cart sitting untouched in
 * localStorage, because that listener is genuinely event-driven — it fires
 * on the CLIENT SDK's own auth actions, not on an external cookie clear it
 * had no part in. AuthContext's SIGNED_OUT branch is still worth keeping as
 * a second safety net for the case Supabase's client fires it on its own
 * (e.g. a background token-refresh failure once the refresh token is
 * genuinely invalid) — but it is not what runs for this app's actual
 * sign-out button, which is why the clear has to happen here too.
 *
 * Clearing the cart synchronously on the click itself, before the server
 * round-trip even starts, is what actually makes "sign out wipes the cart"
 * true for the one sign-out path this app has.
 */
export function signOutAndClearCart(): void {
  useCartStore.getState().clearOnSignOut();
  void signOut();
}
