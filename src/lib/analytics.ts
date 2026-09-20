/**
 * Analytics event layer — no real provider wired up yet. Every event in
 * the app funnels through the single `track()` call below, so swapping in
 * a real vendor (Segment, PostHog, GA4, …) later is a one-function change
 * — see the SWAP POINT comment inside `track()`. Nothing upstream of that
 * point (event names, payload shapes, consent gating) needs to change.
 *
 * Never add a field here that could hold a phone number, a credential, or
 * any other PII — every payload below is deliberately built from
 * non-identifying references (game/order/guide ids, category labels,
 * counts) instead. Order references are the human-readable payment
 * reference (e.g. "GK-3B9E"), never anything tied to a specific person.
 */

export interface AnalyticsEventMap {
  view_game: { gameId: string; genre: string | null; platform: string | null };
  add_to_cart: { gameId: string; price: number };
  remove_from_cart: { gameId: string };
  begin_checkout: { itemCount: number; cartTotal: number };
  select_payment_method: { method: string };
  view_payment_instructions: { orderRef: string; method: string };
  claim_payment: { orderRef: string };
  open_whatsapp: {
    context:
      | "checkout-confirmation"
      | "order-detail"
      | "account"
      | "footer"
      | "contact"
      | "admin"
      | "community"
      | "floating-button";
    orderRef?: string;
  };
  view_order: { orderRef: string; status: string };
  reveal_credentials: { gameId: string; orderRef: string };
  reveal_gift_card_code: { productId: string; orderRef: string };
  view_guide: { guideSlug: string; category: string };
  search_guides: { query: string };
  filter_games: {
    filterType: "genre" | "platform" | "price" | "search";
    value: string;
  };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

// Bridges React consent state to this plain module — track() needs to read
// it synchronously from anywhere (event handlers, effects), not just from
// components, so it can't be a hook. AnalyticsConsentProvider is the only
// intended caller of the setter; see src/contexts/AnalyticsConsentContext.tsx.
let consentGranted = false;

export function setAnalyticsConsent(granted: boolean): void {
  consentGranted = granted;
}

export function hasAnalyticsConsent(): boolean {
  return consentGranted;
}

export function track<K extends AnalyticsEventName>(
  name: K,
  payload: AnalyticsEventMap[K],
): void {
  if (!consentGranted) return;

  const event = {
    name,
    payload,
    timestamp: new Date().toISOString(),
  };

  // ---- SWAP POINT ---------------------------------------------------
  // Replace this block with a real provider call (e.g.
  // `analytics.track(event.name, event.payload)`) once one is chosen.
  // Consent gating and event typing above this line don't change.
  if (process.env.NODE_ENV !== "production") {
    console.log("[analytics]", event.name, event.payload);
  }
  // In production this is currently a deliberate no-op.
  // ---------------------------------------------------------------------
}
