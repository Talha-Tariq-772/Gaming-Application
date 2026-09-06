"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Store", href: "/games" },
  { label: "Gift Cards", href: "/gift-cards" },
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
        className="-my-2 flex min-h-11 items-center"
      >
        {/* logo.webp is a 500x500 canvas but the actual mark only occupies
            a 180x83 region within it at (249,207) (measured via sharp
            .trim()) — sizing the whole square small enough for the header
            would render that mark at a few px, illegible. object-fit:cover
            can't fix this: cropping a wide region out of a SQUARE source
            with a landscape container picks the width-matching scale
            (no horizontal crop at all) rather than the crop I want, since
            cover always avoids under-filling either axis. A plain
            background-image with explicit background-size/-position (a
            fixed 0.4x zoom into that exact region) gives the independent
            horizontal+vertical crop cover can't. */}
        <span
          className="block h-[33px] w-[72px]"
          role="img"
          aria-label="PSCBUNDLE"
          style={{
            backgroundImage: "url(/logo.webp)",
            backgroundSize: "200px 200px",
            backgroundPosition: "-99.6px -82.8px",
            backgroundRepeat: "no-repeat",
          }}
        />
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
