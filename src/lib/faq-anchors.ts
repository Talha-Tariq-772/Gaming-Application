/**
 * Slugs of FAQ entries that other parts of the app deep-link to by name.
 *
 * These are `faqs.slug` values (supabase/migrations/20260920000001_faqs.sql),
 * rendered by FaqAccordion as each <details> element's DOM id. They live
 * here rather than in src/lib/faqs.ts because that module is `server-only`
 * and these are imported by client components (StepConfirmation).
 *
 * An admin editing a slug in /admin/faqs breaks the link that points at
 * it — the form warns about exactly that when editing an existing entry.
 */
export const PAYMENT_VERIFICATION_FAQ_SLUG = "faq-how-verification-works";
