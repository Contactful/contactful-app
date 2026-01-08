import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isMissingColumnError(err: any, col: string) {
  const msg = String(err?.message || "");
  return msg.includes(`column "${col}" does not exist`);
}

export async function POST(req: Request) {
  try {
    const stripe = new Stripe(assertEnv("STRIPE_SECRET_KEY"), {
      apiVersion: "2024-06-20",
    });

    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnon = assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const cookieStore: any = await cookies();

    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        get(name: string) {
          const c = typeof cookieStore?.get === "function" ? cookieStore.get(name) : null;
          return c?.value;
        },
        set() {},
        remove() {},
      },
    });

    // Musisz być zalogowany w app.contactful.app (cookies)
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json(
        { error: "Not authenticated", details: userErr?.message || "Auth session missing" },
        { status: 401 }
      );
    }

    const userId = userData.user.id;

    // Szukamy stripe_customer_id w subscriptions (najprościej)
    let cust: string | null = null;

    const q1 = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("supabase_user_id", userId)
      .order("current_period_end", { ascending: false })
      .limit(1);

    if (!q1.error) {
      cust = q1.data?.[0]?.stripe_customer_id ?? null;
    } else if (isMissingColumnError(q1.error, "supabase_user_id")) {
      const q2 = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .order("current_period_end", { ascending: false })
        .limit(1);
      cust = q2.data?.[0]?.stripe_customer_id ?? null;
    }

    if (!cust) {
      return NextResponse.json(
        { error: "Missing stripe_customer_id on subscriptions for this user" },
        { status: 400 }
      );
    }

    const origin = new URL(req.url).origin; // https://app.contactful.app
    const session = await stripe.billingPortal.sessions.create({
      customer: cust,
      return_url: `${origin}/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Server error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}

