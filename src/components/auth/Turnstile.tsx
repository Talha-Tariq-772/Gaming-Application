"use client";

import Script from "next/script";
import { useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

/**
 * Cloudflare Turnstile widget — bot mitigation on /signup and /login, on
 * top of (not instead of) the server-side rate limit. onVerify fires with
 * the token to submit alongside the form; the token is re-verified
 * server-side (src/lib/turnstile.ts) before any auth call ever runs — the
 * client-side pass/fail here is UX only, same as every other client-side
 * check in this app.
 *
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set in .env.local — see README's Auth
 * section for where to get a real one; the checked-in dev value is
 * Cloudflare's public always-passes test sitekey.
 */
export default function Turnstile({ onVerify }: { onVerify: (token: string) => void }) {
  const containerId = useId().replace(/:/g, "");
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!siteKey) return null;

  function renderWidget() {
    if (!window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(`#${containerId}`, {
      sitekey: siteKey!,
      theme: "auto",
      callback: onVerify,
      "expired-callback": () => onVerify(""),
      "error-callback": () => onVerify(""),
    });
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        onReady={renderWidget}
      />
      <div id={containerId} />
    </>
  );
}
