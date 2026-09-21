/**
 * The canonical phone identity used for account matching (fulfilment-agent
 * WhatsApp lookups against orders, and — see phoneToAuthEmail below — the
 * phone+password auth mapping). Distinct from profiles.phone_number (spaced
 * display format "+92 300 1234567", written by validation.ts's
 * toCanonicalPkPhone via the existing /complete-profile flow and phone+
 * password signup alike) — this is the tight E.164 form "+923001234567".
 * The two are deliberately not consolidated: every existing reader of
 * profiles.phone_number expects the spaced form, and order-search.ts
 * already normalises both sides through this module before comparing, so
 * the mismatch is harmless there. Mixed formats WOULD break a lookup that
 * compares raw strings without normalising first — normalise on the way
 * in, format only for display on the way out.
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

/**
 * Supabase has no phone+password provider without SMS verification (cost),
 * so phone+password auth (src/lib/actions/phone-auth.ts) maps the phone to
 * a synthetic, never-shown internal email and signs up/in against THAT
 * with Supabase's ordinary email+password grant — auth.users.email holds
 * this string, never the user's real email. The UI never displays it; the
 * user only ever sees their phone number.
 *
 * Routed through normalisePhone (not validation.ts's toCanonicalPkPhone)
 * specifically because the mapping must be byte-identical for the same
 * number on every call regardless of how the user typed it — two
 * differently-formatted inputs for the same number must resolve to the
 * exact same auth.users row, or the same person could end up with two
 * accounts. Exactly one function may ever produce this address; do not
 * duplicate this mapping elsewhere.
 *
 * If you're reading this row in `auth.users` six months from now: yes,
 * "923001234567@phone.pscbundle.local" is a real, working login identity
 * for a real customer, not test/seed data or a mistake — see this
 * function's callers in src/lib/actions/phone-auth.ts.
 */
export function phoneToAuthEmail(raw: string): string | null {
  const normalised = normalisePhone(raw);
  if (!normalised) return null;
  return `${normalised.slice(1)}@phone.pscbundle.local`; // slice(1) strips the leading "+"
}

/** True for a phoneToAuthEmail() output — used everywhere a UI might
 * otherwise display auth.users.email/profiles.email verbatim (Header,
 * /admin/users) and needs to skip it instead of leaking the synthetic
 * address to a human. */
export function isSyntheticAuthEmail(email: string | null | undefined): boolean {
  return Boolean(email?.endsWith("@phone.pscbundle.local"));
}

/**
 * The digits-only form wa.me expects in its path: "923001234567" — no "+",
 * no spaces, no leading 0. Accepts either stored format (profiles keep
 * "+92 300 1234567", guest_phone keeps "+923001234567") by going through
 * normalisePhone first, so a spaced number can never produce a broken
 * link. Null for anything that isn't a usable Pakistani mobile, which
 * callers must handle rather than building "https://wa.me/null".
 */
export function toWaMeNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const e164 = normalisePhone(phone);
  return e164 ? e164.slice(1) : null;
}
