import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // ważne: Stripe + node runtime

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia", // jeśli TS krzyczy, usuń tę linię albo ustaw najnowszą wspieraną
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

type Plan = "pro" | "talent" | "networking";

function getPriceId(plan: Plan): string {
  const map: Record<Plan, string | undefined> = {
    pro: process.env.STRIPE_PRICE_ID_PRO,
    talent: process.env.STRIPE_PRICE_ID_TALENT,
    networking: process.env.STRIPE_PRICE_ID_NETWORKING,
  };

  const priceId = map[plan];
  if (!priceId) throw new Error(`Missing Stripe price id for plan: ${plan}`);
  return priceId;
}

export async function POST(req: Request) {
  try {
    // 1) Auth header
    const authHeader = req.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return Response.json(
        { error: "Missing Authorization: Bearer <access_token>" },
        { status: 401 }
      );
    }
    const accessToken = match[1].trim();

    // 2) Plan from body
    const body = await req.json().catch(() => ({}));
    const plan = body?.plan as Plan | undefined;

    if (!plan || !["pro", "talent", "networking"].includes(plan)) {
      return Response.json(
        { error: "Invalid plan. Use one of: pro, talent, networking" },
        { status: 400 }
      );
    }

    // 3) Validate user via Supabase (service role)
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data?.user) {
      return Response.json(
        { error: "Invalid or expired Supabase access token" },
        { status: 401 }
      );
    }

    const user = data.user;
    const supabaseUserId = user.id;
    const email = user.email ?? undefined;

    // 4) Create Stripe Checkout
    const priceId = getPriceId(plan);

    const origin = req.headers.get("origin") || "https://app.contactful.app";
    const successUrl = `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/billing/cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email, // opcjonalnie
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,

      // bardzo ważne: później webhook to odczyta
      metadata: {
        supabase_user_id: supabaseUserId,
        plan,
      },
    });

    return Response.json({ url: session.url }, { status: 200 });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

