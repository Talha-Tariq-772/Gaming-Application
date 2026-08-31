import type { Metadata, Viewport } from "next";
import { Marcellus, Barlow } from "next/font/google";
import FloatingWhatsAppButton from "@/src/components/FloatingWhatsAppButton";
import OfflineBanner from "@/src/components/OfflineBanner";
import Toaster from "@/src/components/Toaster";
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
const displayFont = Marcellus({
  variable: "--font-display-loaded",
  subsets: ["latin"],
  weight: ["400"],
});

const uiFont = Barlow({
  variable: "--font-ui-loaded",
  subsets: ["latin"],
  weight: ["400", "500"],
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
  themeColor: "#08080a",
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
    <html lang="en" className={`${displayFont.variable} ${uiFont.variable}`}>
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
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-30 bg-[url('/grain.png')] bg-repeat opacity-[0.035] mix-blend-overlay"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-30 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--color-nova-void)_100%)] opacity-70"
        />
      </body>
    </html>
  );
}
