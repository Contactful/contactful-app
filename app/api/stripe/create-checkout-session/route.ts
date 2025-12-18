import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ MAPOWANIE plan + billing → env var z price_id
const priceMap = {
  talent: {
    monthly: process.env.STRIPE_PRICE_TALENT_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_TALENT_YEARLY!,
    lifetime: process.env.STRIPE_PRICE_TALENT_LIFETIME!,
  },
  networking: {
    monthly: process.env.STRIPE_PRICE_NETWORKING_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_NETWORKING_YEARLY!,
    lifetime: process.env.STRIPE_PRICE_NETWORKING_LIFETIME!,
  },
  bundle: {
    monthly: process.env.STRIPE_PRICE_BUNDLE_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_BUNDLE_YEARLY!,
    lifetime: process.env.STRIPE_PRICE_BUNDLE_LIFETIME!,
  },
} as const;

type Plan = keyof typeof priceMap; // "talent" | "networking" | "bundle"
type Billing = keyof (typeof priceMap)["talent"]; // "monthly" | "yearly" | "lifetime"

export async function POST(req: Request) {
  try {
    // 1) Auth header
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization: Bearer <access_token>" },
        { status: 401 }
      );
    }

    // 2) Zweryfikuj usera w Supabase (service role)
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(
      token
    );
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Invalid access token" }, { status: 401 });
    }
    const user = userData.user;

    // 3) Body: plan + billing
    const body = await req.json().catch(() => ({}));
    const plan = body.plan as Plan;
    const billing = body.billing as Billing;

    if (!plan || !billing || !(plan in priceMap) || !(billing in priceMap.talent)) {
      return NextResponse.json(
        { error: "Invalid body. Expected { plan: talent|networking|bundle, billing: monthly|yearly|lifetime }" },
        { status: 400 }
      );
    }

    const priceId = priceMap[plan][billing];
    if (!priceId) {
      return NextResponse.json({ error: "Missing priceId env var for selection" }, { status: 500 });
    }

    // 4) Checkout mode: subscription vs payment (lifetime = one-time)
    const mode: Stripe.Checkout.SessionCreateParams.Mode =
      billing === "lifetime" ? "payment" : "subscription";

    // 5) Utwórz Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.contactful.app"}/?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.contactful.app"}/?checkout=cancel`,
      metadata: {
        supabase_user_id: user.id,
        plan,
        billing,
      },
      client_reference_id: user.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

