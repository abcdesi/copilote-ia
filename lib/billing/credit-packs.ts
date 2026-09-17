export const CREDIT_PACKS = [
  {
    key: "credits_500",
    label: "500 crédits",
    credits: 500,
    priceEur: 29,
    costBudgetEur: 5,
    stripePriceEnv: "STRIPE_PRICE_CREDITS_500",
  },
  {
    key: "credits_2000",
    label: "2 000 crédits",
    credits: 2000,
    priceEur: 109,
    costBudgetEur: 20,
    stripePriceEnv: "STRIPE_PRICE_CREDITS_2000",
  },
  {
    key: "credits_5000",
    label: "5 000 crédits",
    credits: 5000,
    priceEur: 269,
    costBudgetEur: 50,
    stripePriceEnv: "STRIPE_PRICE_CREDITS_5000",
  },
] as const;

export type CreditPackKey = (typeof CREDIT_PACKS)[number]["key"];

export function getCreditPack(key?: string | null) {
  return CREDIT_PACKS.find((pack) => pack.key === key) ?? null;
}

export function creditPackStripeReady(key: CreditPackKey) {
  const pack = getCreditPack(key);
  return Boolean(pack && process.env.STRIPE_SECRET_KEY && process.env[pack.stripePriceEnv]);
}
