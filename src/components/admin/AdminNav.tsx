"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/src/lib/actions/auth";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/games", label: "Games" },
  { href: "/admin/credentials", label: "Credentials" },
  { href: "/admin/users", label: "Users" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden w-52 shrink-0 border-r border-border bg-surface-1 md:flex md:flex-col">
        <div className="border-b border-border px-4 py-4">
          <Link
            href="/admin"
            className="-my-3.5 flex min-h-11 items-center py-3.5 text-sm font-bold uppercase tracking-wider text-text"
          >
            Nova Admin
          </Link>
        </div>
        <nav aria-label="Admin" className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-(--duration-fast) ease-standard ${
                isActive(pathname, item.href)
                  ? "bg-accent-dim text-accent"
                  : "text-text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-2">
          <Link
            href="/"
            className="flex min-h-11 items-center rounded-md px-3 py-2 text-xs font-medium text-text-faint hover:bg-surface-2 hover:text-text-muted"
          >
            View Store
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="min-h-11 w-full rounded-md px-3 py-2 text-left text-xs font-medium text-text-faint hover:bg-surface-2 hover:text-text-muted"
          >
            Sign out
          </button>
        </div>
      </aside>

      <nav
        aria-label="Admin"
        className="flex gap-1 overflow-x-auto border-b border-border bg-surface-1 px-3 py-2 md:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${
              isActive(pathname, item.href)
                ? "border-accent bg-accent-dim text-accent"
                : "border-border text-text-muted"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-text-muted"
        >
          View Store
        </Link>
      </nav>
    </>
  );
}
