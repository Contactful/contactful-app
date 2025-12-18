import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function farFutureIso() {
  // lifetime: 100 lat w przód
  return new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
}

export async function POST(req: Request) {
  try {
    const stripeSecret = assertEnv("STRIPE_SECRET_KEY");
    const webhookSecret = assertEnv("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseServiceRole = assertEnv("SUPABASE_SERVICE_ROLE_KEY");

    const stripe = new Stripe(stripeSecret);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // RAW body do weryfikacji podpisu Stripe
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return new Response("Missing stripe-signature", { status: 400 });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err?.message || err);
      return new Response(`Webhook signature verification failed: ${err?.message || String(err)}`, { status: 400 });
    }

    async function upsertSubscription(params: {
      user_id: string;                 // <-- w Twojej tabeli jest user_id
      plan: Plan;
      billing: Billing;
      status: string;
      valid_until: string | null;
      stripe_customer_id?: string | null;
      stripe_subscription_id?: string | null;
      stripe_checkout_session_id?: string | null;
      current_period_end?: string | null;
    }) {
      const payload = {
        user_id: params.user_id,
        supabase_user_id: params.user_id, // zostawiamy spójnie (możesz później usunąć tę kolumnę)
        plan: params.plan,
        billing: params.billing,
        status: params.status,
        valid_until: params.valid_until,
        stripe_customer_id: params.stripe_customer_id ?? null,
        stripe_subscription_id: params.stripe_subscription_id ?? null,
        stripe_checkout_session_id: params.stripe_checkout_session_id ?? null,
        current_period_end: params.current_period_end ?? null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from("subscriptions")
        .upsert(payload, { onConflict: "user_id,plan" });

      if (error) throw new Error(`Supabase upsert error: ${error.message}`);
    }

    async function updateByStripeSubscriptionId(stripe_subscription_id: string, patch: any) {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", stripe_subscription_id);

      if (error) throw new Error(`Supabase update error: ${error.message}`);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.supabase_user_id; // metadata z create-checkout-session
        const plan = normalizePlan(session.metadata?.plan);
        const billing = normalizeBilling(session.metadata?.billing);

        if (!userId || !plan || !billing) {
          console.warn("Missing metadata in checkout.session.completed", { metadata: session.metadata, id: session.id });
          break; // nie 500, żeby Stripe nie retryował bez sensu
        }

        const stripeCustomerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

        // LIFETIME = mode=payment
        if (session.mode === "payment") {
          await upsertSubscription({
            user_id: userId,
            plan,
            billing: "lifetime",
            status: "lifetime",
            valid_until: farFutureIso(),
            stripe_customer_id: stripeCustomerId,
            stripe_checkout_session_id: session.id,
            stripe_subscription_id: null,
            current_period_end: null,
          });
          break;
        }

        // SUBSCRIPTION = mode=subscription
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        let currentPeriodEndIso: string | null = null;

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          currentPeriodEndIso = toIsoFromUnixSeconds(sub.current_period_end);
        }

        await upsertSubscription({
          user_id: userId,
          plan,
          billing,
          status: "active",
          valid_until: currentPeriodEndIso,
          stripe_customer_id: stripeCustomerId,
          stripe_checkout_session_id: session.id,
          stripe_subscription_id: subscriptionId,
          current_period_end: currentPeriodEndIso,
        });

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        const subscriptionId = sub.id;
        const status = sub.status; // active, past_due, canceled...
        const currentPeriodEndIso = toIsoFromUnixSeconds(sub.current_period_end);

        // aktualizujemy rekord po stripe_subscription_id
        await updateByStripeSubscriptionId(subscriptionId, {
          status,
          valid_until: currentPeriodEndIso,
          current_period_end: currentPeriodEndIso,
          stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
        });

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const subscriptionId = sub.id;

        await updateByStripeSubscriptionId(subscriptionId, {
          status: "canceled",
          valid_until: toIsoFromUnixSeconds(sub.current_period_end),
          current_period_end: toIsoFromUnixSeconds(sub.current_period_end),
        });

        break;
      }

      default:
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (e: any) {
    console.error("Stripe webhook error:", e?.message || e);
    return new Response(`Webhook handler error: ${e?.message || String(e)}`, { status: 500 });
  }
}

export async function GET() {
  return new Response("Stripe webhook is alive. Use POST.", { status: 200 });
}

