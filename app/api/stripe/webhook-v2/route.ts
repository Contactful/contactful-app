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

function pickSupabaseUserId(meta: Record<string, any>): string | null {
  const v = meta?.supabase_user_id;
  if (typeof v === "string" && v.length > 10) return v;
  return null;
}

/**
 * GET tylko do szybkiego testu w prod:
 * curl -i https://app.contactful.app/api/stripe/webhook-v2
 */
export async function GET() {
  return new Response("ok", { status: 200 });
}

export async function POST(req: Request) {
  try {
    const stripeSecret = assertEnv("STRIPE_SECRET_KEY");
    const webhookSecret = assertEnv("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseServiceRole = assertEnv("SUPABASE_SERVICE_ROLE_KEY");

    const stripe = new Stripe(stripeSecret);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
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

    // ===== Helpers DB =====

    async function upsertSubscription(row: {
      supabase_user_id: string;
      plan: Plan;
      billing: Billing;
      status: string;
      stripe_customer_id?: string | null;
      stripe_subscription_id?: string | null;
      stripe_checkout_session_id?: string | null;
      current_period_end?: string | null;
      valid_until?: string | null;
    }) {
      // Uwaga: masz unique index na (supabase_user_id, plan)
      // więc robimy upsert onConflict właśnie na tych polach.
      const payload = {
        supabase_user_id: row.supabase_user_id,
        plan: row.plan,
        billing: row.billing,
        status: row.status,
        stripe_customer_id: row.stripe_customer_id ?? null,
        stripe_subscription_id: row.stripe_subscription_id ?? null,
        stripe_checkout_session_id: row.stripe_checkout_session_id ?? null,
        current_period_end: row.current_period_end ?? null,
        valid_until: row.valid_until ?? null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from("subscriptions")
        .upsert(payload, { onConflict: "supabase_user_id,plan" });

      if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
    }

    async function updateByStripeSubscriptionId(
      stripe_subscription_id: string,
      patch: Partial<{
        status: string;
        current_period_end: string | null;
        valid_until: string | null;
        stripe_customer_id: string | null;
      }>
    ) {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", stripe_subscription_id);

      if (error) throw new Error(`Supabase update failed: ${error.message}`);
    }

    // ===== Event handling =====

    switch (event.type) {
      /**
       * Najważniejsze dla subskrypcji checkout.
       * Z Twoich danych: metadata ma plan/billing/supabase_user_id ✅
       */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const meta = (session.metadata || {}) as Record<string, any>;
        const plan = normalizePlan(meta.plan);
        const billing = normalizeBilling(meta.billing);
        const supabaseUserId = pickSupabaseUserId(meta);

        if (!plan || !billing || !supabaseUserId) {
          // Nie wywalamy 500 – Stripe będzie retryował.
          // Lepiej 200 i log, ale tu zwrócimy 200 i zignorujemy.
          console.warn("checkout.session.completed missing metadata", {
            plan: meta.plan,
            billing: meta.billing,
            supabase_user_id: meta.supabase_user_id,
          });
          break;
        }

        const stripeCustomerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

        const stripeSubscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        // Jeśli to tryb subscription, mamy subscriptionId i możemy dociągnąć current_period_end
        let currentPeriodEndIso: string | null = null;
        let status: string = "active";

        if (stripeSubscriptionId) {
          const retrieved = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          const sub = retrieved.data; // ✅ Stripe v20: Response<Subscription> → .data
          currentPeriodEndIso = toIsoFromUnixSeconds(sub.current_period_end);
          status = sub.status || "active";
        }

        await upsertSubscription({
          supabase_user_id: supabaseUserId,
          plan,
          billing,
          status,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_checkout_session_id: session.id,
          current_period_end: currentPeriodEndIso,
          // valid_until możesz trzymać jako alias current_period_end (opcjonalnie)
          valid_until: currentPeriodEndIso,
        });

        break;
      }

      /**
       * Aktualizacje subskrypcji: zmiana statusu, okresu, anulowanie na koniec itd.
       */
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        const subscriptionId = sub.id;
        const status = sub.status;
        const currentPeriodEndIso = toIsoFromUnixSeconds(sub.current_period_end);

        await updateByStripeSubscriptionId(subscriptionId, {
          status,
          current_period_end: currentPeriodEndIso,
          valid_until: currentPeriodEndIso,
          stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
        });

        break;
      }

      /**
       * Usunięcie subskrypcji (np. natychmiastowe)
       */
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        await updateByStripeSubscriptionId(sub.id, {
          status: "canceled",
          current_period_end: toIsoFromUnixSeconds(sub.current_period_end),
          valid_until: toIsoFromUnixSeconds(sub.current_period_end),
        });

        break;
      }

      default:
        // inne eventy ignorujemy
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (e: any) {
    console.error("Stripe webhook v2 error:", e?.message || e);
    return new Response(`Webhook handler error: ${e?.message || String(e)}`, { status: 500 });
  }
}

