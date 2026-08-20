"use client";

import { useState } from "react";

const COPIED_RESET_MS = 1500;

export default function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — nothing to fall back to.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        className="flex min-h-11 shrink-0 items-center rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted transition-colors duration-(--duration-fast) ease-standard hover:border-border-strong hover:text-text"
      >
        {copied ? "Copied" : label}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </>
  );
}
