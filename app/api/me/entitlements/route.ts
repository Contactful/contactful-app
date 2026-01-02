// app/api/me/entitlements/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

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

/**
 * CORS — potrzebne jeśli plugin wysyła Authorization header (preflight).
 * Dla extension i tak zwykle zadziała, ale to najpewniejsze MVP.
 */
function withCors(res: NextResponse, req: Request) {
  const origin = req.headers.get("origin") || "*";

  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "authorization,content-type");

  return res;
}

export async function OPTIONS(req: Request) {
  return withCors(new NextResponse(null, { status: 204 }), req);
}

export async function GET(req: Request) {
  try {
    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnon = assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const bearer = getBearerToken(req);

    // Next 16: cookies() bywa async
    const cookieStore: any = await cookies();

    const supabase = bearer
      ? // ✅ Bearer flow (najpewniejszy): ANON + RLS po JWT
        createClient(supabaseUrl, supabaseAnon, {
          global: { headers: { Authorization: `Bearer ${bearer}` } },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        })
      : // ✅ Cookie flow (fallback)
        createServerClient(supabaseUrl, supabaseAnon, {
          cookies: {
            get(name: string) {
              const c = typeof cookieStore?.get === "function" ? cookieStore.get(name) : null;
              return c?.value;
            },
            set() {},
            remove() {},
          },
        });

    // 1) user z JWT/cookies
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      const res = NextResponse.json(
        {
          error: bearer
            ? "Invalid access token"
            : "Not authenticated (no Bearer token and/or no valid auth cookies)",
          details: userErr?.message || null,
        },
        { status: 401 }
      );
      return withCors(res, req);
    }

    const userId = userData.user.id;

    // 2) subscriptions query (obsłuż obie nazwy kolumn)
    const selectFields = "plan,billing,status,current_period_end";
    let rows: any[] = [];

    const q1 = await supabase
      .from("subscriptions")
      .select(selectFields)
      .eq("supabase_user_id", userId);

    if (!q1.error) {
      rows = q1.data || [];
    } else if (isMissingColumnError(q1.error, "supabase_user_id")) {
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

    // 3) entitlements
    const active = (rows || []).filter((r) => r.status === "active");

    const hasNetworking =
      active.some((r) => r.plan === "networking") || active.some((r) => r.plan === "bundle");
    const hasTalent =
      active.some((r) => r.plan === "talent") || active.some((r) => r.plan === "bundle");
    const hasBundle = active.some((r) => r.plan === "bundle");

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
      { error: "Server error", details: e?.message || String(e) },
      { status: 500 }
    );
    return withCors(res, req);
  }
}

