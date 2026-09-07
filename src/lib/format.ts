/**
 * Every price in the app (catalog, cart, order review) must render
 * through this function — no inline currency formatting in components.
 */
export function formatPrice(amountInPkr: number): string {
  return `Rs ${new Intl.NumberFormat("en-US").format(Math.round(amountInPkr))}`;
}

/**
 * Same as formatPrice but keeps the exact paisa (never rounds) — required
 * anywhere the unique reconciliation offset must survive, e.g. the
 * WhatsApp handoff message and the payment-instructions "amount to
 * transfer" figure.
 */
export function formatPriceExact(amountInPkr: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountInPkr);
  return `Rs ${formatted}`;
}
