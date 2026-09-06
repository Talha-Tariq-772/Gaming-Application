/**
 * The canonical phone identity used for account matching (fulfilment-agent
 * WhatsApp lookups against orders). Distinct from profiles.phone_number
 * (spaced display format, written by the existing /complete-profile flow) —
 * this is the tight E.164 form used by phone+password auth and stored in
 * profiles.phone. Mixed formats here break the agent's lookup, which is the
 * entire point of this module: normalise on the way in, format only for
 * display on the way out.
 */

// Every Pakistani cellular operator (Jazz, Telenor, Zong, Ufone, SCOM) uses a
// local number starting with 3 after the trunk/country prefix; landline area
// codes (021 Karachi, 042 Lahore, 051 Islamabad, ...) never do, so requiring
// the local part to match 3XXXXXXXXX rejects landlines as a side effect of
// the mobile-only rule rather than as a separate check.
const PK_MOBILE_LOCAL = /^(?:\+92|0092|92|0)?(3\d{9})$/;

/**
 * Accepts 03001234567, 3001234567, +923001234567, 00923001234567, with
 * spaces, dashes, or brackets anywhere, and normalises all of them to the
 * same "+923001234567" form. Returns null for anything that isn't a
 * Pakistani mobile number (wrong prefix, wrong length, landline, garbage).
 */
export function normalisePhone(input: string): string | null {
  const stripped = input.replace(/[\s\-()]/g, "");
  const match = stripped.match(PK_MOBILE_LOCAL);
  if (!match) return null;
  return `+92${match[1]}`;
}

/**
 * Formats a normalised E.164 number for display: "+923001234567" ->
 * "0300 123 4567". Assumes its input already passed normalisePhone —
 * callers should never feed this raw user input.
 */
export function formatPhoneDisplay(e164: string): string {
  const local = e164.slice(3); // strip "+92"
  return `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
