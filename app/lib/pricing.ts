// app/lib/pricing.ts

export type Plan = "talent" | "networking" | "bundle";
export type Billing = "monthly" | "yearly" | "lifetime";

export const PLAN_LABEL: Record<Plan, string> = {
  talent: "Talent Pack",
  networking: "Networking Pack",
  bundle: "Bundle (Talent + Networking)",
};

export const BILLING_LABEL: Record<Billing, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
  lifetime: "Lifetime",
};

/**
 * Zwraca env var z Price ID dla danej kombinacji plan+billing.
 * Wymagane ENV:
 * STRIPE_PRICE_TALENT_MONTHLY, STRIPE_PRICE_TALENT_YEARLY, STRIPE_PRICE_TALENT_LIFETIME, ...
 */
export function getPriceId(plan: Plan, billing: Billing): string | null {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${billing.toUpperCase()}`;
  return process.env[key] ?? null;
}

export function formatMoney(unitAmount: number, currency: string) {
  const safe = Number.isFinite(unitAmount) ? unitAmount : 0;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(safe / 100);
  } catch {
    return `${(safe / 100).toFixed(2)} ${(currency || "USD").toUpperCase()}`;
  }
}

