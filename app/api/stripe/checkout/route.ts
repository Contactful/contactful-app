// app/api/stripe/checkout/route.ts
import { NextResponse } from "next/server";
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

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function normalizePlan(p: any): Plan | null {
  return p === "talent" || p === "networking" || p === "bundle" ? p : null;
}

function normalizeBilling(b: any): Billing | null {
  return b === "monthly" || b === "yearly" || b === "lifetime" ? b : null;
}

function getPriceId(plan: Plan, billing: Billing): string | null {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${billing.toUpperCase()}`;
  return process.env[key] ?? null;
}

export async function POST(req: Request) {
  try {
    console.log("▶️ /api/stripe/checkout called");

    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization: Bearer <access_token>" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const plan = normalizePlan(body?.plan);
    const billing = normalizeBilling(body?.billing);

    if (!plan || !billing) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          expected: { plan: "talent|networking|bundle", billing: "monthly|yearly|lifetime" },
        },
        { status: 400 }
      );
    }

    const priceId = getPriceId(plan, billing);
    if (!priceId) {
      return NextResponse.json(
        {
          error: "No Stripe price found for this option. Check env vars.",
          missing_env: `STRIPE_PRICE_${plan.toUpperCase()}_${billing.toUpperCase()}`,
        },
        { status: 500 }
      );
    }

    // Supabase anon + RLS: ustalamy usera z JWT
    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnon = assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json(
        { error: "Invalid access token", details: userErr?.message },
        { status: 401 }
      );
    }

    const userId = userData.user.id;

    const stripe = new Stripe(assertEnv("STRIPE_SECRET_KEY"));

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const successUrl = `${origin}/success?plan=${plan}&billing=${billing}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/upgrade?plan=${plan}`;

    const mode: "payment" | "subscription" = billing === "lifetime" ? "payment" : "subscription";

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,

      // mapowanie
      client_reference_id: userId,
      metadata: { supabase_user_id: userId, plan, billing },
    };

    // ⚠️ customer_creation NIE może być użyte w subscription mode (u Ciebie już to przerabiałeś)
    // A jednocześnie nie wolno podawać customer + customer_creation naraz.
    // Najprościej: zostawiamy bez customer/customer_creation i Stripe i tak utworzy customer przy subskrypcji,
    // jeśli nie przekażesz istniejącego.
    if (mode === "payment") {
      // jeśli chcesz wymusić tworzenie customer w payment:
      sessionParams.customer_creation = "always";
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e: any) {
    console.error("❌ checkout route error:", e);
    return NextResponse.json(
      { error: "Server error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}

