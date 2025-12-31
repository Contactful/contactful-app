// app/api/stripe/prices/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
import { PLAN_LABEL, BILLING_LABEL, type Plan, type Billing } from "@/app/lib/pricing";

export const runtime = "nodejs";

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

type PriceRow = {
  plan: Plan;
  billing: Billing;
  amount: number;     // cents
  currency: string;
  price_id: string;   // Stripe Price ID
  label: string;
};

const PLAN_KEYS: Plan[] = ["talent", "networking", "bundle"];
const BILLING_KEYS: Billing[] = ["monthly", "yearly", "lifetime"];

function envKey(plan: Plan, billing: Billing) {
  return `STRIPE_PRICE_${plan.toUpperCase()}_${billing.toUpperCase()}`;
}

export async function GET() {
  try {
    const out: PriceRow[] = [];

    for (const plan of PLAN_KEYS) {
      for (const billing of BILLING_KEYS) {
        const key = envKey(plan, billing);
        const priceId = process.env[key];

        // jeśli nie masz danego price w env → pomijamy, ale UI wtedy też go nie znajdzie
        if (!priceId) continue;

        // pobieramy z Stripe, żeby mieć prawdziwe kwoty i walutę
        const price = await stripe.prices.retrieve(priceId);

        const amount = price.unit_amount ?? 0;
        const currency = price.currency ?? "usd";

        out.push({
          plan,
          billing,
          amount,
          currency,
          price_id: price.id,
          label: `${PLAN_LABEL[plan]} — ${BILLING_LABEL[billing]}`,
        });
      }
    }

    return NextResponse.json({ prices: out }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to load Stripe prices", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}

