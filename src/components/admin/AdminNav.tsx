"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAndClearCart } from "@/src/lib/actions/sign-out-client";
import ThemeToggle from "@/src/components/ThemeToggle";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/games", label: "Games" },
  { href: "/admin/slider", label: "Slider" },
  { href: "/admin/credentials", label: "Credentials" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/faqs", label: "FAQs" },
  { href: "/admin/resets", label: "Resets" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden w-52 shrink-0 border-r border-nova-hairline bg-nova-crypt md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-nova-hairline px-4 py-4">
          <Link
            href="/admin"
            className="-my-3.5 flex min-h-11 items-center py-3.5 text-sm font-bold uppercase tracking-wider text-nova-bone"
          >
            PSCBUNDLE Admin
          </Link>
          <ThemeToggle />
        </div>
        <nav aria-label="Admin" className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-(--duration-fast) ease-standard ${
                isActive(pathname, item.href)
                  ? "bg-nova-ember-bright text-nova-void"
                  : "text-nova-ash hover:bg-nova-slab hover:text-nova-bone"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-nova-hairline p-2">
          <Link
            href="/"
            className="flex min-h-11 items-center rounded-md px-3 py-2 text-xs font-medium text-nova-smoke hover:bg-nova-slab hover:text-nova-ash"
          >
            View Store
          </Link>
          <button
            type="button"
            onClick={() => signOutAndClearCart()}
            className="min-h-11 w-full rounded-md px-3 py-2 text-left text-xs font-medium text-nova-smoke hover:bg-nova-slab hover:text-nova-ash"
          >
            Sign out
          </button>
        </div>
      </aside>

      <nav
        aria-label="Admin"
        className="flex items-center gap-1 overflow-x-auto border-b border-nova-hairline bg-nova-crypt px-3 py-2 md:hidden"
      >
        <ThemeToggle />
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${
              isActive(pathname, item.href)
                ? "border-nova-ember bg-nova-ember-bright text-nova-void"
                : "border-nova-hairline text-nova-ash"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center rounded-full border border-nova-hairline px-3 py-1.5 text-xs font-semibold text-nova-ash"
        >
          View Store
        </Link>
      </nav>
    </>
  );
}
