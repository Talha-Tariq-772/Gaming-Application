"use client";

import type { ReactNode } from "react";
import { track, type AnalyticsEventMap } from "@/src/lib/analytics";

export default function TrackedWhatsAppLink({
  href,
  context,
  orderRef,
  className,
  children,
}: {
  href: string;
  context: AnalyticsEventMap["open_whatsapp"]["context"];
  orderRef: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("open_whatsapp", { context, orderRef })}
      className={className}
    >
      {children}
    </a>
  );
}
