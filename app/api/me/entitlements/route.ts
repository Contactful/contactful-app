import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function hasActiveRow(row: any) {
  if (!row) return false;
  if (row.status !== "active") return false;

  if (row.billing === "lifetime") return true;

  // monthly/yearly – sprawdzamy datę
  if (!row.current_period_end) return false;
  return new Date(row.current_period_end).getTime() > Date.now();
}

export async function GET(req: Request) {
  try {
    const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing Authorization: Bearer <access_token>" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid access token" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const { data: rows, error } = await supabase
      .from("subscriptions")
      .select("plan,billing,status,current_period_end")
      .eq("user_id", userId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const byPlan: Record<string, any> = {};
    for (const r of rows || []) {
      // jeśli masz kilka wpisów per plan, bierz “najlepszy” (lifetime > active > reszta)
      const prev = byPlan[r.plan];
      if (!prev) byPlan[r.plan] = r;
      else {
        const prevActive = hasActiveRow(prev);
        const curActive = hasActiveRow(r);
        if (!prevActive && curActive) byPlan[r.plan] = r;
        if (prev.billing !== "lifetime" && r.billing === "lifetime") byPlan[r.plan] = r;
      }
    }

    const talent = hasActiveRow(byPlan["talent"]);
    const networking = hasActiveRow(byPlan["networking"]);
    const bundle = hasActiveRow(byPlan["bundle"]);

    // bundle daje oba
    const entitlements = {
      talent: bundle || talent,
      networking: bundle || networking,
      bundle,
      source: {
        talent: byPlan["talent"] || null,
        networking: byPlan["networking"] || null,
        bundle: byPlan["bundle"] || null,
      },
    };

    return new Response(JSON.stringify(entitlements), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}


