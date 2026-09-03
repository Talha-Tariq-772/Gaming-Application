import type { Metadata, Viewport } from "next";
import { Marcellus, Barlow } from "next/font/google";
import FloatingWhatsAppButton from "@/src/components/FloatingWhatsAppButton";
import OfflineBanner from "@/src/components/OfflineBanner";
import Toaster from "@/src/components/Toaster";
import ThemeProvider from "@/src/components/ThemeProvider";
import { AnalyticsConsentProvider } from "@/src/contexts/AnalyticsConsentContext";
import { AuthProvider } from "@/src/contexts/AuthContext";
import SmoothScrollProvider from "@/src/components/motion/SmoothScrollProvider";
import { SITE_NAME, SITE_URL } from "@/src/lib/site-config";
import "./globals.css";

// Session 9: swapped from Cinzel (600/700) to Marcellus, which Google
// Fonts only ships at weight 400 — there is no 600/700 file to request.
// Every font-display heading's weight is centrally governed by the two
// compound rules in globals.css (.font-display.text-display-lg/-md/-sm
// and .font-display.text-lg/-xl/-2xl), both updated to font-weight: 400
// alongside this change, plus a `.font-display { font-synthesis: none }`
// safety net there for the handful of call sites that request a bold
// utility class directly instead of going through those two rules — see
// that file for the full reasoning. Do not add weight: ["600"] or
// ["700"] back here; Marcellus doesn't have those files, and Next would
// either fail to build or silently fall back in a way that reintroduces
// the exact synthetic-bold risk this session's change is meant to avoid.
// display: "block" (not the default "swap"): Marcellus is display-only —
// headings, the wordmark, page titles. "block" gives a short (~3s)
// invisible period before the real font paints, instead of visibly
// flashing fallback-then-real the way "swap" does. Correction to this
// comment's first version: block alone does NOT stop the underlying
// layout shift — it only makes the fallback-to-real transition invisible;
// the browser still lays out an invisible fallback box during the block
// period and reflows when the real font's different width replaces it,
// which still scores as CLS even with nothing visibly flashing. Confirmed
// by measuring /privacy with Marcellus's font file blocked outright (so
// the swap/reflow never happens at all): CLS dropped further than "block"
// alone achieved. So this pairs with adjustFontFallback: false below —
// "block" hides the flash, the hand-tuned fallback (globals.css's
// "Marcellus Fallback" rule) closes the actual width gap so there's
// nothing left to reflow when the real font arrives. That rule's own
// comment has the real measured delta (13.6%, not the ~2.2% this comment
// first assumed from an unrepresentative sample — see that comment for
// why the difference matters). Never use "block" for body text — see
// uiFont below.
const displayFont = Marcellus({
  variable: "--font-display-loaded",
  subsets: ["latin"],
  weight: ["400"],
  display: "block",
  adjustFontFallback: false,
  fallback: ["Marcellus Fallback"],
});

// Barlow is body copy — a "block" invisible period here would leave
// paragraphs unreadable on a slow connection, which is worse than a small
// layout shift. Stays "swap" (the default), but adjustFontFallback is
// disabled in favor of a hand-tuned fallback (see globals.css's
// "Barlow Fallback" rule) — canvas.measureText() on real body text found
// Next's auto-generated fallback rendering it ~0.86% wider than real
// Barlow, which is small but real: on a page with several long paragraphs
// (a legal page, easily 1500+ characters) that's enough to move a wrap
// point. The hand-tuned rule corrects size-adjust for that specific delta
// while preserving the same absolute ascent/descent Next's own version
// already got right (see that rule's comment for the math) — a "swap" font
// this precisely metric-matched should approach zero measurable reflow
// without ever going invisible.
const uiFont = Barlow({
  variable: "--font-ui-loaded",
  subsets: ["latin"],
  weight: ["400", "500"],
  adjustFontFallback: false,
  fallback: ["Barlow Fallback"],
});

const DEFAULT_TITLE = `${SITE_NAME} — Cinematic Game Storefront`;
const DEFAULT_DESCRIPTION =
  "A curated, cinematic home for the games you play next.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  // Media-query pair (not a single value) so the mobile browser-chrome
  // tint follows OS-level light/dark — matches nova-void's two theme
  // values (globals.css). This is a static <meta> tag, so it can only ever
  // track `prefers-color-scheme`, not an explicit in-app ThemeToggle
  // override (that would need a client-side meta tag rewrite); same
  // limitation most sites with a manual theme toggle accept.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#08060a" },
  ],
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${uiFont.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col antialiased">
        {/* Our own static config, not user input — safe to serialize directly. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-md focus:bg-nova-ember focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-accent"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <AuthProvider>
            <AnalyticsConsentProvider>
              <OfflineBanner />
              <SmoothScrollProvider>
                {children}
                <Toaster />
              </SmoothScrollProvider>
              <FloatingWhatsAppButton />
            </AnalyticsConsentProvider>
          </AuthProvider>
          {/*
            NOVA_DESIGN_SPEC.md #2 texture layer. z-30 is deliberate, not the
            spec's literal z-index:50 — every modal/drawer/panel in this app
            (CartDrawer, the admin dialogs) already uses
            z-40 or z-50, so z-50 here would visually wash the texture over
            them. z-30 sits above ordinary page content (z-auto) and below
            every one of those, including the lowest (z-40 slide-over panels).
            Grain renders first, vignette second, so the vignette's edge
            darkening composites on top of the grain speckle, matching the
            spec's own listed order.

            Light theme: opacity classes below are the DARK-mode values;
            globals.css's `.light` block turns both down (grain) or off
            (vignette) — see that file for why a dark-tuned vignette can't
            just be left as-is on a light page.
          */}
          <div
            aria-hidden="true"
            className="nova-grain pointer-events-none fixed inset-0 z-30 bg-[url('/grain.png')] bg-repeat opacity-[0.035] mix-blend-overlay"
          />
          {/*
            Vignette opacity was 70% — measured (Sept 2026 button-brightness
            investigation) to composite up to ~70% flat black over anything
            sitting in its outer band, since this sits in front of ordinary
            content (see comment above) with no blend mode, not multiplied
            against it. A primary CTA (ember-bright, #E85D1F) positioned
            there measured 4.03:1 against its own text at the old 70%,
            under the 4.5:1 floor, despite the button's own computed
            background-color being the correct token value — the dimming was
            happening one paint layer above it. 10% keeps a real corner
            darkening but stays under the ~14% ceiling (verified via
            audit/section7-contrast.mjs-style luminance math) where a
            full-strength ember-bright fill in the outer band still clears
            4.5:1 against void text.
          */}
          <div
            aria-hidden="true"
            className="nova-vignette pointer-events-none fixed inset-0 z-30 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--color-nova-void)_100%)] opacity-10"
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
