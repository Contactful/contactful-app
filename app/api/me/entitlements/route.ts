// app/api/me/entitlements/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

/* ================= utils ================= */

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

function isMissingColumnError(err: any, col: string) {
  const msg = String(err?.message || "");
  return msg.includes(`column "${col}" does not exist`);
}

/* ================= CORS ================= */

/**
 * IMPORTANT:
 * - credentials:true ⇒ Access-Control-Allow-Origin MUST NOT be "*"
 * - Chrome extension sends Origin header → echo it back
 * - fallback to app.contactful.app
 */
function withCors(res: NextResponse, req: Request) {
  const origin =
    req.headers.get("origin") ||
    "https://app.contactful.app";

  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "authorization,content-type"
  );

  return res;
}

export async function OPTIONS(req: Request) {
  return withCors(new NextResponse(null, { status: 204 }), req);
}

/* ================= GET ================= */

export async function GET(req: Request) {
  try {
    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnon = assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const bearer = getBearerToken(req);

    /**
     * Next 16: cookies() bywa async
     * getAll/setAll is REQUIRED for stable Supabase SSR
     */
    const cookieStore: any = await cookies();

    const supabase = bearer
      ? // ---------- Bearer flow (extension token bridge) ----------
        createClient(supabaseUrl, supabaseAnon, {
          global: {
            headers: {
              Authorization: `Bearer ${bearer}`,
            },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        })
      : // ---------- Cookie flow (logged-in web app) ----------
        createServerClient(supabaseUrl, supabaseAnon, {
          cookies: {
            getAll() {
              return cookieStore
                .getAll()
                .map((c: any) => ({ name: c.name, value: c.value }));
            },
            // GET endpoint → no writes needed
            setAll() {},
          },
        });

    /* ---------- 1) AUTH ---------- */

    const { data: userData, error: userErr } =
      await supabase.auth.getUser();

    if (userErr || !userData?.user) {
      const res = NextResponse.json(
        {
          error: bearer
            ? "Invalid access token"
            : "Not authenticated (no Bearer token and/or no valid auth cookies)",
          details: userErr?.message || "Auth session missing!",
        },
        { status: 401 }
      );
      return withCors(res, req);
    }

    const userId = userData.user.id;

    /* ---------- 2) SUBSCRIPTIONS ---------- */

    const selectFields = "plan,billing,status,current_period_end";
    let rows: any[] = [];

    // try supabase_user_id first
    const q1 = await supabase
      .from("subscriptions")
      .select(selectFields)
      .eq("supabase_user_id", userId);

    if (!q1.error) {
      rows = q1.data || [];
    } else if (isMissingColumnError(q1.error, "supabase_user_id")) {
      // fallback to user_id
      const q2 = await supabase
        .from("subscriptions")
        .select(selectFields)
        .eq("user_id", userId);

      if (q2.error) {
        const res = NextResponse.json(
          { error: "DB query failed", details: q2.error.message },
          { status: 500 }
        );
        return withCors(res, req);
      }
      rows = q2.data || [];
    } else {
      const res = NextResponse.json(
        { error: "DB query failed", details: q1.error.message },
        { status: 500 }
      );
      return withCors(res, req);
    }

    /* ---------- 3) ENTITLEMENTS ---------- */

    const active = (rows || []).filter(
      (r) => r.status === "active"
    );

    const hasBundle = active.some((r) => r.plan === "bundle");
    const hasNetworking =
      hasBundle || active.some((r) => r.plan === "networking");
    const hasTalent =
      hasBundle || active.some((r) => r.plan === "talent");

    const res = NextResponse.json({
      user_id: userId,
      entitlements: {
        networking: hasNetworking,
        talent: hasTalent,
        bundle: hasBundle,
      },
      subscriptions: rows || [],
    });

    return withCors(res, req);
  } catch (e: any) {
    console.error("❌ /api/me/entitlements error:", e);

    const res = NextResponse.json(
      {
        error: "Server error",
        details: e?.message || String(e),
      },
      { status: 500 }
    );
    return withCors(res, req);
  }
}

