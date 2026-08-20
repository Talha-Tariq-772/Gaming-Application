"use client";

import Link from "next/link";
import { track, type AnalyticsEventMap } from "@/src/lib/analytics";

/**
 * Thin client wrapper so server-rendered pages (Footer, /contact) can fire
 * open_whatsapp on click without themselves becoming client components.
 */
export default function WhatsAppLink({
  href,
  context,
  orderRef,
  className,
  children,
}: {
  href: string;
  context: AnalyticsEventMap["open_whatsapp"]["context"];
  orderRef?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("open_whatsapp", { context, orderRef })}
      className={className}
    >
      {children}
    </Link>
  );
}
