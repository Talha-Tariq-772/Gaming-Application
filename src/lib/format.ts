/**
 * Every price in the app (catalog, cart, order review) must render
 * through this function — no inline currency formatting in components.
 */
export function formatPrice(amountInPkr: number): string {
  return `Rs ${new Intl.NumberFormat("en-US").format(Math.round(amountInPkr))}`;
}
