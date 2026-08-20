"use client";

import Link from "next/link";
import { useState } from "react";
import Button from "@/components/Button";
import CopyButton from "@/src/components/checkout/CopyButton";
import { useAuth } from "@/src/contexts/AuthContext";
import { track } from "@/src/lib/analytics";
import { revealCredential } from "@/src/lib/actions/credentials";
import { formatDateTime } from "@/src/lib/date";
import { REDEMPTION_GUIDE_SLUG } from "@/src/lib/mock-guides";

/**
 * Security notes:
 * - The decrypted credential is only ever held in this component's local
 *   state — never in a persisted store (Zustand stores here are persisted
 *   to localStorage, which would otherwise leave plaintext secrets sitting
 *   on disk indefinitely). Refreshing the page clears it; revealing again
 *   re-fetches from the server (revealCredential is idempotent — it won't
 *   overwrite the original revealed_at, just re-decrypts and returns it).
 * - Credential values are decrypted server-side only (src/lib/actions/
 *   credentials.ts) and never passed to console.log or any client logging.
 */
export default function CredentialReveal({
  orderId,
  orderRef,
  gameId,
  gameTitle,
  setupGuide,
}: {
  orderId: string;
  orderRef: string;
  gameId: string;
  gameTitle: string;
  setupGuide: string;
}) {
  const { profile } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<{
    login: string;
    password: string;
    revealedAt: string;
  } | null>(null);

  async function handleReveal() {
    if (!profile) return;
    setRevealing(true);
    setError(null);
    const result = await revealCredential(orderId, profile.id, "");
    setRevealing(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCredential({ login: result.login, password: result.password, revealedAt: result.revealedAt });
    track("reveal_credentials", { gameId, orderRef });
  }

  return (
    <div className="rounded-lg border border-border bg-surface-1 p-6">
      <h3 className="font-display text-lg font-bold text-text">
        {gameTitle}
      </h3>

      <span role="status" aria-live="polite" className="sr-only">
        {credential ? `${gameTitle} credentials revealed` : ""}
      </span>

      {!credential ? (
        <div className="mt-4 flex flex-col items-start gap-4 rounded-md border border-warning/30 bg-warning-dim p-4">
          <p className="text-sm text-warning">
            These details are shown once. Save them before closing this
            page.
          </p>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="button" variant="primary" onClick={handleReveal} disabled={revealing}>
            {revealing ? "Revealing…" : "Reveal Credentials"}
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="rounded-md border border-danger/30 bg-danger-dim px-4 py-3 text-sm font-semibold text-danger">
            Do not share these details with anyone.
          </div>

          <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-2 px-4 py-3">
            <div className="min-w-0">
              <span className="block text-xs text-text-faint">Login</span>
              <span className="block truncate font-mono text-sm text-text">
                {credential.login}
              </span>
            </div>
            <CopyButton value={credential.login} />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-2 px-4 py-3">
            <div className="min-w-0">
              <span className="block text-xs text-text-faint">Password</span>
              <span className="block truncate font-mono text-sm text-text">
                {showPassword
                  ? credential.password
                  : "•".repeat(credential.password.length)}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="flex min-h-11 items-center px-1 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
              <CopyButton value={credential.password} />
            </div>
          </div>

          <p className="text-xs text-text-faint">
            Revealed on {formatDateTime(credential.revealedAt)}
          </p>

          <div className="mt-2 rounded-md border border-border bg-surface-2 p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-faint">
              Setup Guide
            </h4>
            <p className="text-sm text-text-muted">{setupGuide}</p>
            <Link
              href={`/guides/${REDEMPTION_GUIDE_SLUG}`}
              className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:text-accent-strong"
            >
              Read the full redemption guide →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
