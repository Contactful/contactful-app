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

function unwrapStripe<T>(obj: any): T {
  // Stripe SDK bywa typowany jako Response<T> albo T – ujednolicamy:
  if (obj && typeof obj === "object" && "data" in obj) return obj.data as T;
  return obj as T;
}

function normalizePlan(p: any): Plan | null {
  if (p === "talent" || p === "networking" || p === "bundle") return p;
  return null;
}

function normalizeBilling(b: any): Billing | null {
  if (b === "monthly" || b === "yearly" || b === "lifetime") return b;
  return null;
}

function toIsoFromUnixSeconds(sec?: number | null) {
  if (!sec) return null;
  return new Date(sec * 1000).toISOString();
}

function getCurrentPeriodEndIso(sub: any) {
  // w Stripe Subscription jest current_period_end (unix seconds)
  return toIsoFromUnixSeconds(sub?.current_period_end ?? null);
}

function extractUserIdFromSession(session: any): string | null {
  // Najważniejsze: metadata.supabase_user_id ustawiasz przy create-checkout-session
  const meta = session?.metadata || {};
  return (
    meta?.supabase_user_id ||
    session?.client_reference_id ||
    null
  );
}

export async function POST(req: Request) {
  try {
    const stripeSecret = assertEnv("STRIPE_SECRET_KEY");
    const webhookSecret = assertEnv("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseServiceRole = assertEnv("SUPABASE_SERVICE_ROLE_KEY");

    const stripe = new Stripe(stripeSecret);
    const supabase = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false },
    });

    // Stripe wymaga RAW body do weryfikacji podpisu
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return new Response("Missing stripe-signature", { status: 400 });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      return new Response(`Webhook signature verification failed: ${err?.message || String(err)}`, {
        status: 400,
      });
    }

    switch (event.type) {
      /* ---------------- checkout completed ---------------- */
      case "checkout.session.completed": {
        const session = unwrapStripe<Stripe.Checkout.Session>(event.data.object as any) as any;

        const userId = extractUserIdFromSession(session);
        if (!userId) {
          console.error("❌ Missing user id in session.metadata.supabase_user_id / client_reference_id", {
            session_id: session?.id,
          });
          return new Response("Missing user id", { status: 400 });
        }

        const plan = normalizePlan(session?.metadata?.plan);
        const billing = normalizeBilling(session?.metadata?.billing);

        if (!plan || !billing) {
          console.error("❌ Missing plan/billing in session.metadata", {
            plan: session?.metadata?.plan,
            billing: session?.metadata?.billing,
            session_id: session?.id,
          });
          return new Response("Missing plan/billing", { status: 400 });
        }

        let status = "active";
        let currentPeriodEnd: string | null = null;

        const stripeCustomerId =
          typeof session.customer === "string" ? session.customer : null;

        const stripeSubscriptionId =
          typeof session.subscription === "string" ? session.subscription : null;

        // Jeśli to subskrypcja, pobierz current_period_end
        if (stripeSubscriptionId) {
          const retrieved = await stripe.subscriptions.retrieve(stripeSubscriptionId as any);
          const sub = unwrapStripe<Stripe.Subscription>(retrieved as any) as any;
          currentPeriodEnd = getCurrentPeriodEndIso(sub);
          status = sub?.status ?? "active";
        } else {
          // lifetime/payment – zostaw null
          currentPeriodEnd = null;
          status = "active";
        }

        // ✅ KLUCZOWA ZMIANA: zapis do kolumny user_id
        const { error } = await supabase
          .from("subscriptions")
          .upsert(
            {
              user_id: userId, // <-- było supabase_user_id
              plan,
              billing,
              status,
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId,
              stripe_checkout_session_id: session.id,
              current_period_end: currentPeriodEnd,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,plan" } // <-- było supabase_user_id,plan
          );

        if (error) {
          console.error("❌ Supabase upsert error:", error);
          return new Response("DB upsert failed", { status: 500 });
        }

        break;
      }

      /* ---------------- subscription updated ---------------- */
      case "customer.subscription.updated": {
        const sub = unwrapStripe<Stripe.Subscription>(event.data.object as any) as any;

        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: sub?.status ?? "active",
            current_period_end: getCurrentPeriodEndIso(sub),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", sub.id);

        if (error) {
          console.error("❌ Supabase update error:", error);
          return new Response("DB update failed", { status: 500 });
        }

        break;
      }

      /* ---------------- subscription deleted ---------------- */
      case "customer.subscription.deleted": {
        const sub = unwrapStripe<Stripe.Subscription>(event.data.object as any) as any;

        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            current_period_end: getCurrentPeriodEndIso(sub),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", sub.id);

        if (error) {
          console.error("❌ Supabase update error:", error);
          return new Response("DB update failed", { status: 500 });
        }

        break;
      }

      default:
        // ignore
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (err: any) {
    console.error("❌ Webhook handler error:", err?.message || err);
    return new Response(`Webhook handler failed: ${err?.message || String(err)}`, { status: 500 });
  }
}

