mkdir -p app/api/stripe/webhook
cat > app/api/stripe/webhook/route.ts <<'EOF'
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

export async function POST(req: Request) {
  try {
    const stripeSecret = assertEnv("STRIPE_SECRET_KEY");
    const webhookSecret = assertEnv("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseServiceRole = assertEnv("SUPABASE_SERVICE_ROLE_KEY");

    const stripe = new Stripe(stripeSecret);

    // RAW body do weryfikacji podpisu
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return new Response("Missing stripe-signature", { status: 400 });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      return new Response(`Webhook signature verification failed: ${err.message}`, {
        status: 400,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

    async function upsertByCheckoutSession(session: Stripe.Checkout.Session, patch: any) {
      const sessionId = session.id;

      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("stripe_checkout_session_id", sessionId);

      if (error) throw error;
    }

    async function updateByStripeSubscriptionId(subscriptionId: string, patch: any) {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", subscriptionId);

      if (error) throw error;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // metadata z create-checkout-session:
        const plan = normalizePlan(session.metadata?.plan);
        const billing = normalizeBilling(session.metadata?.billing);
        const supabaseUserId = session.metadata?.supabase_user_id;

        if (!plan || !billing || !supabaseUserId) {
          console.warn("Missing/invalid metadata on checkout.session.completed", session.metadata);
          break;
        }

        // Jeśli subskrypcja: session.subscription będzie ustawione
        const stripeSubscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

        const stripeCustomerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

        await upsertByCheckoutSession(session, {
          supabase_user_id: supabaseUserId,
          plan,
          billing,
          status: stripeSubscriptionId ? "active" : "paid",
          stripe_checkout_session_id: session.id,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_customer_id: stripeCustomerId,
        });

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const subscriptionId = sub.id;

        const status = sub.status;
        const currentPeriodEndIso = toIsoFromUnixSeconds(sub.current_period_end);

        await updateByStripeSubscriptionId(subscriptionId, {
          status,
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
          current_period_end: toIsoFromUnixSeconds(sub.current_period_end),
        });

        break;
      }

      default:
        // ignorujemy resztę
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (e: any) {
    console.error("Stripe webhook error:", e?.message || e);
    return new Response(`Webhook handler error: ${e?.message || String(e)}`, { status: 500 });
  }
}
EOF

