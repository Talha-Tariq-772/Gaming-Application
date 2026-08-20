"use client";

import Button from "@/components/Button";
import { track, type AnalyticsEventMap } from "@/src/lib/analytics";

/** Same idea as WhatsAppLink, styled as a Button — for CTAs like /contact's
 * "Open WhatsApp" rather than an inline text link. */
export default function WhatsAppButton({
  href,
  context,
  orderRef,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  context: AnalyticsEventMap["open_whatsapp"]["context"];
  orderRef?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      as="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      variant={variant}
      className={className}
      onClick={() => track("open_whatsapp", { context, orderRef })}
    >
      {children}
    </Button>
  );
}
