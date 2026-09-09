"use client";

import { useEffect, useState } from "react";
import { isSyntheticAuthEmail } from "@/src/lib/phone";
import { safeStorage } from "@/src/lib/safe-storage";
import { useAuth } from "@/src/contexts/AuthContext";

const DISMISS_KEY = "gk-phone-auth-prompt-dismissed";

/**
 * Google accounts keep working exactly as before — this is purely
 * informational, dismissible, and never blocks anything (see STEP 5:
 * "never lock anyone out"). Shown only to accounts signed in via a real
 * (non-synthetic) email, i.e. Google — a phone+password account's own
 * auth.users.email is always the "@phone.pscbundle.local" synthetic
 * address (see src/lib/phone.ts's phoneToAuthEmail), so this never shows
 * to someone who already has phone+password sign-in.
 */
export default function GooglePhoneAuthPrompt() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(true); // default hidden until checked, avoids a flash

  useEffect(() => {
    setDismissed(safeStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (!user?.email || isSyntheticAuthEmail(user.email) || dismissed) {
    return null;
  }

  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-nova-hairline bg-nova-crypt px-4 py-3 text-sm text-nova-ash">
      <p>You can now also log in with just your phone number and a password, if you&rsquo;d rather not use Google.</p>
      <button
        type="button"
        onClick={() => {
          safeStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        className="shrink-0 font-semibold text-nova-ember-text hover:text-nova-ember-lo"
      >
        Dismiss
      </button>
    </div>
  );
}
