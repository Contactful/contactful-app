// app/lib/stripe.ts
import Stripe from "stripe";

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// Stripe v20: nie ustawiamy apiVersion ręcznie (żeby TS nie wywalał builda)
export const stripe = new Stripe(assertEnv("STRIPE_SECRET_KEY"));

