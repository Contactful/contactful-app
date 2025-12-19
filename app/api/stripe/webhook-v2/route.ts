import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/* -------------------- helpers -------------------- */

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function toIsoFromUnix(sec?: number | null): string | null {
  return sec ? new Date(sec * 1000).toISOString() : null;
}

/** Stripe v20 czasem zwraca Response<T>, czasem T */
function unwrapStripe<T>(v: any): T {
  return v && typeof v === "object" && "data" in v ? (v.data as T) : (v as T);
}

/** Typy Stripe v20 potrafią nie mieć current_period_end → czytamy bezpiecznie */
function getCurrentPeriodEndIso(sub: any): string | null {
  const sec = sub?.current_period_end ?? sub?.currentPeriodEnd ?? null; // fallback
  return typeof sec === "number" ? toIsoFromUnix(sec) : null;
}

/* -------------------- handler -------------------- */

export async function POST(req: Request) {
  const stripe = new Stripe(assertEnv("STRIPE_SECRET_KEY"));
  const webhookSecret = assertEnv("STRIPE_WEBHOOK_SECRET");

  const supabase = createClient(
    assertEnv("NEXT_PUBLIC_SUPABASE_URL"),
    assertEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("❌ Webhook signature error:", err?.message || err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      /* ---------------- checkout completed ---------------- */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan;
        const billing = session.metadata?.billing;

        if (!userId || !plan || !billing) {
          console.warn("⚠️ Missing metadata in session", session.id);
          break;
        }

        let currentPeriodEnd: string | null = null;
        let status = "active";

        if (session.subscription) {
          const retrieved = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          const sub = unwrapStripe<Stripe.Subscription>(retrieved) as any;

          currentPeriodEnd = getCurrentPeriodEndIso(sub);
          status = sub?.status ?? "active";
        }

        const { error } = await supabase
          .from("subscriptions")
          .upsert(
            {
              supabase_user_id: userId,
              plan,
              billing,
              status,
              stripe_customer_id:
                typeof session.customer === "string" ? session.customer : null,
              stripe_subscription_id:
                typeof session.subscription === "string"
                  ? session.subscription
                  : null,
              stripe_checkout_session_id: session.id,
              current_period_end: currentPeriodEnd,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "supabase_user_id,plan" }
          );

        if (error) {
          console.error("❌ Supabase upsert error:", error);
          return new Response("DB upsert failed", { status: 500 });
        }

        break;
      }

      /* ---------------- subscription updated ---------------- */
      case "customer.subscription.updated": {
        const sub = unwrapStripe<Stripe.Subscription>(event.data.object) as any;

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
        const sub = unwrapStripe<Stripe.Subscription>(event.data.object) as any;

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
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (err: any) {
    console.error("❌ Webhook handler error:", err?.message || err);
    return new Response("Webhook handler failed", { status: 500 });
  }
}

