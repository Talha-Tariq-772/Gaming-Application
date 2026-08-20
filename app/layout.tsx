import type { Metadata, Viewport } from "next";
import { Syne, Inter } from "next/font/google";
import OfflineBanner from "@/src/components/OfflineBanner";
import Toaster from "@/src/components/Toaster";
import { AnalyticsConsentProvider } from "@/src/contexts/AnalyticsConsentContext";
import { AuthProvider } from "@/src/contexts/AuthContext";
import SmoothScrollProvider from "@/src/components/motion/SmoothScrollProvider";
import { SITE_NAME, SITE_URL } from "@/src/lib/site-config";
import "./globals.css";

const displayFont = Syne({
  variable: "--font-display-loaded",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const sansFont = Inter({
  variable: "--font-sans-loaded",
  subsets: ["latin"],
  weight: "variable",
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
    <html lang="en" className={`${displayFont.variable} ${sansFont.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        {/* Our own static config, not user input — safe to serialize directly. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-accent"
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
          </AnalyticsConsentProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
