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

/** Stripe v20 może zwracać Response<T> albo T */
function unwrapStripe<T>(v: any): T {
  return v && typeof v === "object" && "data" in v ? (v.data as T) : (v as T);
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
  if (!sig) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("❌ Webhook signature error:", err.message);
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
          console.warn("⚠️ Missing metadata", session.id);
          break;
        }

        let currentPeriodEnd: string | null = null;
        let status = "active";

        if (session.subscription) {
          const sub = unwrapStripe<Stripe.Subscription>(
            await stripe.subscriptions.retrieve(
              session.subscription as string
            )
          );

          currentPeriodEnd = toIsoFromUnix(sub.current_period_end);
          status = sub.status ?? "active";
        }

        await supabase
          .from("subscriptions")
          .upsert(
            {
              supabase_user_id: userId,
              plan,
              billing,
              status,
              stripe_customer_id:
                typeof session.customer === "string"
                  ? session.customer
                  : null,
              stripe_subscription_id:
                typeof session.subscription === "string"
                  ? session.subscription
                  : null,
              stripe_checkout_session_id: session.id,
              current_period_end: currentPeriodEnd,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "supabase_user_id,plan",
            }
          );

        break;
      }

      /* ---------------- subscription updated ---------------- */
      case "customer.subscription.updated": {
        const sub = unwrapStripe<Stripe.Subscription>(event.data.object);

        await supabase
          .from("subscriptions")
          .update({
            status: sub.status,
            current_period_end: toIsoFromUnix(sub.current_period_end),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", sub.id);

        break;
      }

      /* ---------------- subscription deleted ---------------- */
      case "customer.subscription.deleted": {
        const sub = unwrapStripe<Stripe.Subscription>(event.data.object);

        await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            current_period_end: toIsoFromUnix(sub.current_period_end),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", sub.id);

        break;
      }

      default:
        // ignore other events
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (err: any) {
    console.error("❌ Webhook handler error:", err);
    return new Response("Webhook handler failed", { status: 500 });
  }
}

