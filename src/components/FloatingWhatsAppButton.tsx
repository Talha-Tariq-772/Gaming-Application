"use client";

import { usePathname } from "next/navigation";
import { track } from "@/src/lib/analytics";
import { buildGeneralWhatsAppLink } from "@/src/lib/order";

/**
 * Site-wide floating WhatsApp entry point, mounted once at the root layout.
 * Hidden on /checkout — that flow has its own contextual WhatsApp link with
 * the order's payment reference prefilled (see StepConfirmation.tsx), and
 * showing both would be a confusing duplicate. Hidden on every /admin
 * route too — this is a customer-support entry point with no purpose in
 * the staff tool, and it was rendering on top of admin table rows.
 */
export default function FloatingWhatsAppButton() {
  const pathname = usePathname();
  if (pathname?.startsWith("/checkout") || pathname?.startsWith("/admin")) return null;

  return (
    <a
      href={buildGeneralWhatsAppLink()}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("open_whatsapp", { context: "floating-button" })}
      aria-label="Chat with us on WhatsApp"
      className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform duration-(--duration-fast) ease-standard hover:scale-105"
      style={{
        right: "calc(1.5rem + env(safe-area-inset-right))",
        bottom: "calc(1.5rem + env(safe-area-inset-bottom))",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-7 w-7"
        aria-hidden="true"
      >
        <path d="M12.001 2c-5.523 0-10 4.477-10 10 0 1.768.462 3.484 1.34 4.997L2 22l5.145-1.318A9.955 9.955 0 0 0 12.001 22c5.523 0 10-4.477 10-10s-4.477-10-10-10zm0 18.163a8.13 8.13 0 0 1-4.146-1.135l-.297-.176-3.084.79.822-3.005-.194-.309a8.132 8.132 0 0 1-1.263-4.328c0-4.495 3.658-8.153 8.164-8.153 4.495 0 8.153 3.658 8.153 8.153-.001 4.506-3.659 8.163-8.155 8.163z" />
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      </svg>
    </a>
  );
}
