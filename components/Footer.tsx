import Link from "next/link";
import WhatsAppLink from "@/src/components/WhatsAppLink";
import { getPaymentMethods } from "@/src/lib/catalog";
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

export default async function Footer() {
  const paymentMethods = await getPaymentMethods();
  const acceptedPaymentMethods = paymentMethods.map((m) => m.label).join(", ");

  const TRUST_SIGNALS = [
    { heading: "We Accept", body: acceptedPaymentMethods },
    {
      heading: "Verification Time",
      body: "Typically 1–2 hours during business hours (9am–9pm PKT)",
    },
  ];

  return (
    <footer className="border-t border-nova-hairline bg-nova-void">
      <div className="mx-auto max-w-page px-4 py-24 md:px-8">
        <div className="mb-16 grid gap-8 border-b border-nova-hairline pb-16 sm:grid-cols-3">
          {TRUST_SIGNALS.map((signal) => (
            <div key={signal.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-nova-smoke">
                {signal.heading}
              </h2>
              <p className="mt-3 text-sm text-nova-ash">{signal.body}</p>
            </div>
          ))}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-nova-smoke">
              Support
            </h2>
            <p className="mt-3 text-sm text-nova-ash">
              {/* -my-2.5/py-2.5 reserves a 44px tap target (WCAG/platform
                  minimum) without growing the text itself or the
                  paragraph's line height — same pattern as the nav/social
                  links elsewhere in this file. Was a bare inline link with
                  no reserved height at all (measured 148x16px). */}
              <WhatsAppLink
                href={buildGeneralWhatsAppLink()}
                context="footer"
                className="-my-2.5 inline-flex min-h-11 items-center py-2.5 font-semibold text-nova-ember hover:text-nova-ember-lo"
              >
                Message us on WhatsApp
              </WhatsAppLink>{" "}
              · 9am–9pm PKT
            </p>
          </div>
        </div>

        <div className="grid gap-16 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <span className="font-display text-xl font-bold tracking-tight text-nova-bone">
              NOVA
            </span>
            <p className="mt-4 text-sm text-nova-ash">
              A cinematic home for the games you play next. Curated
              storefront, built for players.
            </p>
          </div>

          {LINK_GROUPS.map((group) => (
            <div key={group.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-nova-smoke">
                {group.heading}
              </h2>
              <ul className="mt-6 flex flex-col gap-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="-my-2.5 flex min-h-11 items-center py-2.5 text-sm text-nova-ash transition-colors duration-(--duration-fast) ease-standard hover:text-nova-bone"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-24 flex flex-col-reverse items-center justify-between gap-6 border-t border-nova-hairline pt-8 md:flex-row">
          <p className="text-xs text-nova-smoke">
            &copy; {new Date().getFullYear()} Nova. All rights reserved.
          </p>
          <div className="flex items-center gap-8">
            {SOCIALS.map((label) => (
              <Link
                key={label}
                href="#"
                className="-my-2.5 flex min-h-11 min-w-11 items-center justify-center py-2.5 text-xs font-medium uppercase tracking-[0.08em] text-nova-ash transition-colors duration-(--duration-fast) ease-standard hover:text-nova-ember"
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
