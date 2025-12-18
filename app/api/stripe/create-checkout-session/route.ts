import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Plan = "talent" | "networking" | "bundle";
type Billing = "monthly" | "yearly" | "lifetime";

function getOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const host = req.headers.get("host");
  if (host) return `https://${host}`;
  return "https://app.contactful.app";
}

function getHostFromUrl(u?: string) {
  try {
    return new URL(u || "").host;
  } catch {
    return null;
  }
}

function decodeJwtIss(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], "base64").toString("utf8");
    const payload = JSON.parse(payloadJson);
    return payload?.iss || null;
  } catch {
    return null;
  }
}

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

/**
 * Twoje price IDs (z Twojej wiadomości)
 */
const PRICE: Record<Plan, Record<Billing, string>> = {
  talent: {
    monthly: "price_1SfdoWIdbjQOuR384OgsmIhb",
    yearly: "price_1SfdoDIdbjQOuR38HRjXwSj6",
    lifetime: "price_1Sfdr0IdbjQOuR386PuEls8s",
  },
  networking: {
    monthly: "price_1SfdpMIdbjQOuR38H1uuQROL",
    yearly: "price_1SfdpeIdbjQOuR38CX8v1Seu",
    lifetime: "price_1SfdrXIdbjQOuR38pSoRBmpz",
  },
  bundle: {
    monthly: "price_1Sfdq7IdbjQOuR388sb3jl3t",
    yearly: "price_1SfdqNIdbjQOuR389i9gXzwx",
    lifetime: "price_1Sfds3IdbjQOuR381hIQVvhJ",
  },
};

export async function POST(req: Request) {
  try {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return Response.json(
        { error: "Missing Authorization: Bearer <access_token>" },
        { status: 401 }
      );
    }

    // --- DIAGNOSTYKA: czy token należy do tego samego projektu Supabase co ENV ---
    const tokenIss = decodeJwtIss(accessToken);
    const envSupabaseHost = getHostFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

    if (tokenIss && envSupabaseHost && !tokenIss.includes(envSupabaseHost)) {
      return Response.json(
        {
          error: "Invalid access token (project mismatch)",
          token_iss: tokenIss,
          env_supabase_url_host: envSupabaseHost,
          hint: "Frontend logged into a different Supabase project than backend env vars in Vercel.",
        },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRole) {
      return Response.json(
        {
          error: "Missing Supabase env vars",
          missing: {
            NEXT_PUBLIC_SUPABASE_URL: !supabaseUrl,
            SUPABASE_SERVICE_ROLE_KEY: !serviceRole,
          },
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return Response.json(
        { error: "Invalid access token", details: userErr?.message || "No user returned" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const plan = body?.plan as Plan;
    const billing = body?.billing as Billing;

    if (!plan || !["talent", "networking", "bundle"].includes(plan)) {
      return Response.json({ error: "Invalid plan" }, { status: 400 });
    }
    if (!billing || !["monthly", "yearly", "lifetime"].includes(billing)) {
      return Response.json({ error: "Invalid billing" }, { status: 400 });
    }

    const priceId = PRICE[plan][billing];
    if (!priceId) {
      return Response.json({ error: "Price not configured" }, { status: 400 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return Response.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey);

    const origin = getOrigin(req);

    // lifetime = one-time payment, monthly/yearly = subscription
    const mode: Stripe.Checkout.SessionCreateParams.Mode =
      billing === "lifetime" ? "payment" : "subscription";

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/success?plan=${plan}&billing=${billing}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/upgrade?plan=${plan}`,
      metadata: {
        supabase_user_id: userData.user.id,
        plan,
        billing,
      },
      client_reference_id: userData.user.id,
      // (opcjonalnie) możesz od razu wymusić email z profilu:
      customer_email: userData.user.email || undefined,
    });

    return Response.json({ url: session.url }, { status: 200 });
  } catch (e: any) {
    return Response.json(
      { error: "Server error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}

