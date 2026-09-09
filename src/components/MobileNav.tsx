"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import { NAV_LINKS, isActive } from "@/src/components/HeaderNav";
import { signOutAndClearCart } from "@/src/lib/actions/sign-out-client";
import { prefersReducedMotion } from "@/src/lib/motion-guards";
import { DEFAULT_STAGGER } from "@/src/lib/motion";
import { useFocusTrap } from "@/src/lib/use-focus-trap";

/** Mirrors the three states Header.tsx already derives server-side
 * (signed out / needs a phone on file / fully signed in) — passed down
 * rather than re-derived here so this stays a plain client component with
 * no session logic of its own. */
export type MobileAuthState =
  | { status: "signed-out" }
  | { status: "needs-profile" }
  | { status: "signed-in"; name: string; avatarUrl: string | null; isStaff: boolean };

/**
 * Below-md replacement for HeaderNav's link list, which simply disappears
 * at that breakpoint with nothing standing in for it. Structurally the
 * same off-canvas pattern as CartDrawer (fixed inset-y-0 right-0, h-dvh,
 * same z-60 tier, useFocusTrap for the trap/Escape/scroll-lock) rather
 * than a second overlay system — the only real differences are content
 * and the entrance stagger on the links.
 */
export default function MobileNav({ mobileAuth }: { mobileAuth: MobileAuthState }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen, close);

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
  }, []);

  // Closes on route change regardless of *how* it changed (a nav link's
  // own onClick already closes it before the transition even lands, but
  // browser back/forward or any other navigation source needs this as
  // the real backstop — a menu still open after the page underneath it
  // has changed is exactly the "feels broken" case called out for this).
  const previousPathname = useRef(pathname);
  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      setIsOpen(false);
    }
  }, [pathname]);

  function open() {
    setIsOpen(true);
  }
  function close() {
    setIsOpen(false);
  }

  const motionClass = reducedMotion ? "" : "transition-transform duration-(--duration-base) ease-standard";
  const backdropMotionClass = reducedMotion ? "" : "transition-opacity duration-(--duration-base) ease-standard";

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-nav-panel"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-nova-hairline bg-nova-crypt text-nova-bone transition-colors duration-(--duration-fast) ease-standard hover:border-nova-ember/40 md:hidden"
      >
        <span aria-hidden="true" className="flex h-4 w-5 flex-col justify-between">
          <span
            className={`h-0.5 w-full origin-center rounded-full bg-current transition-transform duration-(--duration-fast) ease-standard ${
              isOpen ? "translate-y-[7px] rotate-45" : ""
            }`}
          />
          <span
            className={`h-0.5 w-full rounded-full bg-current transition-opacity duration-(--duration-fast) ease-standard ${
              isOpen ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`h-0.5 w-full origin-center rounded-full bg-current transition-transform duration-(--duration-fast) ease-standard ${
              isOpen ? "-translate-y-[7px] -rotate-45" : ""
            }`}
          />
        </span>
      </button>

      <div
        onClick={close}
        aria-hidden="true"
        className={`fixed inset-0 z-60 bg-nova-void/70 md:hidden ${backdropMotionClass} ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        id="mobile-nav-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!isOpen}
        className={`fixed inset-y-0 right-0 z-60 flex h-dvh w-full max-w-sm flex-col border-l border-nova-hairline bg-nova-void md:hidden ${motionClass} ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-nova-hairline px-6 py-4">
          <span className="font-display text-lg font-bold text-nova-bone">Menu</span>
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="-mr-2 flex h-11 w-11 items-center justify-center text-nova-ash hover:text-nova-bone"
          >
            ✕
          </button>
        </div>

        <nav aria-label="Primary" className="flex flex-1 flex-col overflow-y-auto px-6 py-4">
          {NAV_LINKS.map((link, index) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.label}
                href={link.href}
                onClick={close}
                aria-current={active ? "page" : undefined}
                style={
                  reducedMotion
                    ? undefined
                    : { transitionDelay: isOpen ? `${index * DEFAULT_STAGGER}s` : "0s" }
                }
                className={`flex min-h-14 items-center border-l-2 pl-4 font-display text-2xl ${
                  reducedMotion ? "" : `transition-[color,opacity,transform,border-color] duration-(--duration-fast) ease-standard`
                } ${
                  active
                    ? "border-nova-ember text-nova-bone"
                    : "border-transparent text-nova-ash hover:text-nova-bone"
                } ${
                  reducedMotion ? "" : isOpen ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-nova-hairline p-6">
          <MobileAuthSection state={mobileAuth} onNavigate={close} />
        </div>
      </div>
    </>
  );
}

function MobileAuthSection({
  state,
  onNavigate,
}: {
  state: MobileAuthState;
  onNavigate: () => void;
}) {
  if (state.status === "signed-out") {
    return (
      <Button as="a" href="/sign-in" variant="primary" onClick={onNavigate} className="w-full">
        Sign In
      </Button>
    );
  }

  if (state.status === "needs-profile") {
    return (
      <Link
        href="/complete-profile"
        onClick={onNavigate}
        className="flex min-h-11 items-center justify-center text-sm font-semibold uppercase tracking-wider text-nova-gild hover:text-nova-gild/80"
      >
        Complete your profile
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="mb-2 truncate text-sm text-nova-ash">{state.name}</p>
      <Link
        href="/account"
        onClick={onNavigate}
        className="flex min-h-11 items-center text-sm font-medium text-nova-bone hover:text-nova-ember-text"
      >
        Account
      </Link>
      {state.isStaff && (
        <Link
          href="/admin"
          onClick={onNavigate}
          className="flex min-h-11 items-center text-sm font-medium text-nova-bone hover:text-nova-ember-text"
        >
          Admin
        </Link>
      )}
      <button
        type="button"
        onClick={() => {
          onNavigate();
          signOutAndClearCart();
        }}
        className="flex min-h-11 items-center text-left text-sm font-medium text-nova-ash hover:text-nova-bone"
      >
        Sign Out
      </button>
    </div>
  );
}
