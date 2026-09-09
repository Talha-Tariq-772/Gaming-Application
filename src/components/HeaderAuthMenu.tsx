"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOutAndClearCart } from "@/src/lib/actions/sign-out-client";

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
        className="flex min-h-11 items-center gap-2 rounded-full border border-nova-hairline bg-nova-slab py-1 pl-1 pr-3 text-sm font-medium text-nova-bone transition-colors duration-(--duration-fast) ease-standard hover:border-nova-ember/40 hover:bg-nova-hairline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-ember focus-visible:ring-offset-2 focus-visible:ring-offset-nova-void"
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
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-nova-ember-bright text-xs font-bold text-nova-void">
            {initial}
          </span>
        )}
        <span className="max-w-32 truncate">{name}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-48 rounded-md border border-nova-hairline bg-nova-crypt py-1 shadow-lg"
        >
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center px-4 text-sm text-nova-bone hover:bg-nova-slab"
          >
            Account
          </Link>
          {isStaff && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center px-4 text-sm text-nova-bone hover:bg-nova-slab"
            >
              Admin
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => signOutAndClearCart()}
            className="flex min-h-11 w-full items-center px-4 text-left text-sm text-nova-ash hover:bg-nova-slab hover:text-nova-bone"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
