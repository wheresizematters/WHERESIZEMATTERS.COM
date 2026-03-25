// ── Stripe (PWA) ─────────────────────────────────────────────────────────────
export const STRIPE_PUBLISHABLE_KEY = 'pk_live_51TDr6JDJ34xtd2FlKH4NFwLLjIuRHbc0WQlLQi2aSsJucfe3JV0pj86TlELBeDWzy59v6LfAdoywWcDRDQyMCFRa00YKjEJKEm';
export const STRIPE_PRICE_MONTHLY = 'prod_UCKzjGPikLiAkC';
export const STRIPE_PRICE_ANNUAL  = 'prod_UCKzzdDRpKljcB';

// Stripe Payment Links — no backend needed
const STRIPE_LINK_MONTHLY = 'https://buy.stripe.com/fZu3cv8DQdTzfOfeDwe3e00';
const STRIPE_LINK_ANNUAL  = 'https://buy.stripe.com/eVqbJ1bQ2aHn1Xpdzse3e01';

export async function stripeCheckout(plan: 'monthly' | 'annual', userId: string) {
  const base = plan === 'annual' ? STRIPE_LINK_ANNUAL : STRIPE_LINK_MONTHLY;
  window.location.href = `${base}?client_reference_id=${userId}`;
}

export function isPremiumUser(premiumStatus: boolean): boolean {
  return premiumStatus;
}
