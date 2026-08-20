import Link from "next/link";
import WhatsAppLink from "@/src/components/WhatsAppLink";
import { MOCK_PAYMENT_METHODS } from "@/src/lib/mock-data";
import { buildGeneralWhatsAppLink } from "@/src/lib/order";

const LINK_GROUPS = [
  {
    heading: "Platform",
    links: [
      { label: "Store", href: "/games" },
      { label: "Library", href: "/library" },
      { label: "News", href: "/news" },
      { label: "Community", href: "/community" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "#" },
      { label: "Press", href: "#" },
      { label: "Partners", href: "#" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Guides", href: "/guides" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Refund Policy", href: "/refund-policy" },
    ],
  },
];

const SOCIALS = ["X", "Discord", "YouTube", "Twitch"];

const ACCEPTED_PAYMENT_METHODS = MOCK_PAYMENT_METHODS.filter(
  (m) => m.isActive,
)
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((m) => m.label)
  .join(", ");

const TRUST_SIGNALS = [
  { heading: "We Accept", body: ACCEPTED_PAYMENT_METHODS },
  {
    heading: "Verification Time",
    body: "Typically 1–2 hours during business hours (9am–9pm PKT)",
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="mx-auto max-w-page px-4 py-24 md:px-8">
        <div className="mb-16 grid gap-8 border-b border-border pb-16 sm:grid-cols-3">
          {TRUST_SIGNALS.map((signal) => (
            <div key={signal.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-faint">
                {signal.heading}
              </h2>
              <p className="mt-3 text-sm text-text-muted">{signal.body}</p>
            </div>
          ))}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-faint">
              Support
            </h2>
            <p className="mt-3 text-sm text-text-muted">
              <WhatsAppLink
                href={buildGeneralWhatsAppLink()}
                context="footer"
                className="font-semibold text-accent hover:text-accent-strong"
              >
                Message us on WhatsApp
              </WhatsAppLink>{" "}
              · 9am–9pm PKT
            </p>
          </div>
        </div>

        <div className="grid gap-16 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <span className="font-display text-xl font-bold tracking-tight text-text">
              NOVA
            </span>
            <p className="mt-4 text-sm text-text-muted">
              A cinematic home for the games you play next. Curated
              storefront, built for players.
            </p>
          </div>

          {LINK_GROUPS.map((group) => (
            <div key={group.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-faint">
                {group.heading}
              </h2>
              <ul className="mt-6 flex flex-col gap-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="-my-2.5 flex min-h-11 items-center py-2.5 text-sm text-text-muted transition-colors duration-(--duration-fast) ease-standard hover:text-text"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-24 flex flex-col-reverse items-center justify-between gap-6 border-t border-border pt-8 md:flex-row">
          <p className="text-xs text-text-faint">
            &copy; {new Date().getFullYear()} Nova. All rights reserved.
          </p>
          <div className="flex items-center gap-8">
            {SOCIALS.map((label) => (
              <Link
                key={label}
                href="#"
                className="-my-2.5 flex min-h-11 min-w-11 items-center justify-center py-2.5 text-xs font-medium uppercase tracking-[0.08em] text-text-muted transition-colors duration-(--duration-fast) ease-standard hover:text-accent"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
