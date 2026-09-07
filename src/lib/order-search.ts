import { normalisePhone } from "@/src/lib/phone";
import type { Order } from "@/src/types/database";

/**
 * Strips a leading "PSC-"/"GK-" (either reference format this app has ever
 * generated, case-insensitive) and surrounding whitespace. Applying this
 * same function to both sides of a comparison — the order's real
 * reference and whatever the agent typed — is what makes "tolerant of a
 * missing prefix" work without special-casing the query.
 */
export function referenceCore(raw: string): string {
  return raw.trim().toUpperCase().replace(/^(PSC|GK)-?/, "");
}

/**
 * True if `order` matches a pasted admin search query — by payment
 * reference (either prefix or none, case-insensitive, whitespace-
 * tolerant) or by phone number (the order's own guest_phone, or the
 * linked customer's profile phone), normalised through phone.ts so any
 * input format — spaced, dashed, with/without country code — matches.
 */
export function matchesOrderSearch(
  order: Pick<Order, "paymentReference" | "guestPhone">,
  customerPhoneNumber: string | null | undefined,
  query: string,
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  const wantedRef = referenceCore(trimmed);
  if (wantedRef && referenceCore(order.paymentReference) === wantedRef) return true;

  const wantedPhone = normalisePhone(trimmed);
  if (!wantedPhone) return false;
  if (order.guestPhone && normalisePhone(order.guestPhone) === wantedPhone) return true;
  return Boolean(customerPhoneNumber && normalisePhone(customerPhoneNumber) === wantedPhone);
}
