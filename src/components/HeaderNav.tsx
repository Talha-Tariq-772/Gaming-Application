"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Store", href: "/games" },
  { label: "Library", href: "/library" },
  { label: "News", href: "/news" },
  { label: "Community", href: "/community" },
];

/** Exact match for "/" (otherwise every route would match it); prefix match
 * for everything else so a game detail page still shows Store as active. */
function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Split out from Header.tsx (a server component reading the auth session)
 * because active-state highlighting needs the current pathname, which only
 * a client component can read via usePathname() — same reasoning as
 * AdminNav.tsx's isActive pattern.
 */
export default function HeaderNav() {
  const pathname = usePathname();
  const onHome = pathname === "/";

  return (
    <>
      <Link
        href="/"
        aria-current={onHome ? "page" : undefined}
        className={`-my-2 flex min-h-11 items-center font-display text-xl font-bold transition-colors duration-(--duration-fast) ease-standard ${
          onHome ? "text-nova-ember" : "text-nova-bone"
        }`}
      >
        NOVA
      </Link>

      <nav aria-label="Primary" className="hidden items-center gap-8 md:flex lg:gap-16">
        {NAV_LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.label}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`-my-2 flex min-h-11 items-center border-b-2 text-sm font-medium uppercase tracking-[0.08em] transition-colors duration-(--duration-fast) ease-standard hover:text-nova-bone ${
                active
                  ? "border-nova-ember text-nova-bone"
                  : "border-transparent text-nova-ash"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
