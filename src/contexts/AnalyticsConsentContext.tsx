"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { setAnalyticsConsent } from "@/src/lib/analytics";

interface AnalyticsConsentValue {
  hasConsent: boolean;
  setHasConsent: (granted: boolean) => void;
}

const AnalyticsConsentContext = createContext<AnalyticsConsentValue | null>(
  null,
);

/**
 * Owns the one piece of state `track()` checks before it fires anything.
 * No real cookie banner exists yet, so this defaults to granted — purely
 * so events are visible in the console while building against this app.
 * Once a real consent UI exists, flip the initial state below to `false`
 * and have that UI call `setHasConsent(true)` on opt-in; nothing else in
 * the analytics layer needs to change.
 */
export function AnalyticsConsentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hasConsent, setHasConsent] = useState(true);

  useEffect(() => {
    setAnalyticsConsent(hasConsent);
  }, [hasConsent]);

  return (
    <AnalyticsConsentContext.Provider value={{ hasConsent, setHasConsent }}>
      {children}
    </AnalyticsConsentContext.Provider>
  );
}

export function useAnalyticsConsent(): AnalyticsConsentValue {
  const ctx = useContext(AnalyticsConsentContext);
  if (!ctx) {
    throw new Error(
      "useAnalyticsConsent must be used within an AnalyticsConsentProvider",
    );
  }
  return ctx;
}
