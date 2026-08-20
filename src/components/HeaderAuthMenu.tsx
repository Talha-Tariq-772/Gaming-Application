"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/src/lib/actions/auth";

export default function HeaderAuthMenu({
  name,
  avatarUrl,
  isStaff,
}: {
  name: string;
  avatarUrl: string | null;
  isStaff: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const showAvatar = Boolean(avatarUrl) && !avatarFailed;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface-2 py-1 pl-1 pr-3 text-sm font-medium text-text transition-colors duration-(--duration-fast) ease-standard hover:border-border-strong hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {showAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Google avatar URL varies by account type; not a good fit for next/image's fixed remote-pattern allowlist
          <img
            src={avatarUrl ?? undefined}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setAvatarFailed(true)}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-dim text-xs font-bold text-accent">
            {initial}
          </span>
        )}
        <span className="max-w-32 truncate">{name}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-48 rounded-md border border-border bg-surface-1 py-1 shadow-lg"
        >
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center px-4 text-sm text-text hover:bg-surface-2"
          >
            Account
          </Link>
          {isStaff && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center px-4 text-sm text-text hover:bg-surface-2"
            >
              Admin
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut()}
            className="flex min-h-11 w-full items-center px-4 text-left text-sm text-text-muted hover:bg-surface-2 hover:text-text"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
