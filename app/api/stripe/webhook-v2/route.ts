// app/api/stripe/webhook-v2/route.ts
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Plan = "talent" | "networking" | "bundle";
type Billing = "monthly" | "yearly" | "lifetime";

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function toIsoFromUnixSeconds(sec?: number | null) {
  if (!sec) return null;
  return new Date(sec * 1000).toISOString();
}

function normalizePlan(p: any): Plan | null {
  if (p === "talent" || p === "networking" || p === "bundle") return p;
  return null;
}

function normalizeBilling(b: any): Billing | null {
  if (b === "monthly" || b === "yearly" || b === "lifetime") return b;
  return null;
}

type SubscriptionRow = {
  supabase_user_id: string;
  plan: Plan;
  billing: Billing;
  status: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_checkout_session_id?: string | null;
  current_period_end?: string | null;
};

export async function POST(req: Request) {
  try {
    const stripeSecret = assertEnv("STRIPE_SECRET_KEY");
    const webhookSecret = assertEnv("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseServiceRole = assertEnv("SUPABASE_SERVICE_ROLE_KEY");

    const stripe = new Stripe(stripeSecret);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

    // Stripe wymaga RAW body do weryfikacji podpisu
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return new Response("Missing stripe-signature", { status: 400 });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      return new Response(`Webhook signature verification failed: ${err?.message || err}`, {
        status: 400,
      });
    }

    async function upsertByStripeSubscriptionId(payload: SubscriptionRow) {
      // Zakładamy, że masz UNIQUE na stripe_subscription_id
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .upsert(
          {
            ...payload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stripe_subscription_id" }
        );

      if (error) throw error;
    }

    async function upsertByCheckoutSessionId(payload: SubscriptionRow) {
      // Zakładamy, że masz UNIQUE na stripe_checkout_session_id
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .upsert(
          {
            ...payload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stripe_checkout_session_id" }
        );

      if (error) throw error;
    }

    async function updateByStripeSubscriptionId(stripeSubscriptionId: string, patch: Partial<SubscriptionRow>) {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({
          ...patch,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", stripeSubscriptionId);

      if (error) throw error;
    }

    // =========================
    // EVENT HANDLING
    // =========================
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // metadata, które ustawiasz w create-checkout-session
        const plan = normalizePlan((session.metadata as any)?.plan);
        const billing = normalizeBilling((session.metadata as any)?.billing);
        const supabaseUserId = (session.metadata as any)?.supabase_user_id as string | undefined;

        if (!plan || !billing || !supabaseUserId) {
          // Nie przerywamy webhooka błędem 500 — po prostu log i 200,
          // żeby Stripe nie spamował retry jeśli metadata nie ma.
          console.warn("Webhook: missing/invalid metadata", {
            plan,
            billing,
            supabaseUserId,
            sessionId: session.id,
          });
          return new Response("ok", { status: 200 });
        }

        const stripeCustomerId =
          typeof session.customer === "string"
            ? session.customer
            : (session.customer as any)?.id ?? null;

        const stripeSubscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription as any)?.id ?? null;

        // status + current_period_end (dla subscription)
        let status = "active";
        let currentPeriodEndIso: string | null = null;

        if (session.mode === "subscription" && stripeSubscriptionId) {
          const retrieved = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          // Stripe v20 typing bywa mylący w TS – runtime to normalny obiekt subskrypcji
          const sub: any = retrieved;

          status = sub.status || "active";
          currentPeriodEndIso = toIsoFromUnixSeconds(sub.current_period_end);
        }

        const payload: SubscriptionRow = {
          supabase_user_id: supabaseUserId,
          plan,
          billing,
          status,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_checkout_session_id: session.id,
          current_period_end: currentPeriodEndIso,
        };

        // Preferuj upsert po stripe_subscription_id, ale fallback na session_id
        if (stripeSubscriptionId) {
          await upsertByStripeSubscriptionId(payload);
        } else {
          await upsertByCheckoutSessionId(payload);
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subObj = event.data.object as Stripe.Subscription;

        const stripeSubscriptionId = subObj.id;
        const stripeCustomerId =
          typeof subObj.customer === "string" ? subObj.customer : (subObj.customer as any)?.id ?? null;

        const status = (subObj as any).status || "active";
        const currentPeriodEndIso = toIsoFromUnixSeconds((subObj as any).current_period_end);

        // Tu plan/billing/supabase_user_id bierzemy z metadata subskrypcji,
        // ale jeśli nie masz ich na sub, to zostawiamy tylko update statusu/period_end.
        const plan = normalizePlan((subObj.metadata as any)?.plan);
        const billing = normalizeBilling((subObj.metadata as any)?.billing);
        const supabaseUserId = (subObj.metadata as any)?.supabase_user_id as string | undefined;

        if (plan && billing && supabaseUserId) {
          await upsertByStripeSubscriptionId({
            supabase_user_id: supabaseUserId,
            plan,
            billing,
            status,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            current_period_end: currentPeriodEndIso,
          });
        } else {
          // Minimalny update — bez plan/billing jeśli metadata nie ma
          await updateByStripeSubscriptionId(stripeSubscriptionId, {
            status,
            current_period_end: currentPeriodEndIso,
            stripe_customer_id: stripeCustomerId,
          });
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subObj = event.data.object as Stripe.Subscription;
        const stripeSubscriptionId = subObj.id;

        await updateByStripeSubscriptionId(stripeSubscriptionId, {
          status: "canceled",
          current_period_end: toIsoFromUnixSeconds((subObj as any).current_period_end),
        });

        break;
      }

      // (opcjonalnie) jeśli chcesz — często wystarcza do “podtrzymania active”
      case "invoice.payment_succeeded": {
        // nie musisz nic robić — ale możesz np. logować
        break;
      }

      default:
        // ignorujemy resztę
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (e: any) {
    console.error("Stripe webhook-v2 error:", e?.message || e);
    return new Response(`Webhook handler error: ${e?.message || String(e)}`, { status: 500 });
  }
}
