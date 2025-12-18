"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Plan = "talent" | "networking" | "bundle";
type Billing = "monthly" | "yearly" | "lifetime";

export default function UpgradePage() {
  const [plan, setPlan] = useState<Plan>("bundle");
  const [billing, setBilling] = useState<Billing>("monthly");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("plan") as Plan | null;
    if (p === "talent" || p === "networking" || p === "bundle") setPlan(p);
  }, []);

  const title = useMemo(() => {
    if (plan === "talent") return "Upgrade to Talent";
    if (plan === "networking") return "Upgrade to Networking";
    return "Upgrade to Bundle";
  }, [plan]);

  async function startCheckout() {
    setLoading(true);
    setMsg(null);

    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;

    if (!token) {
      setLoading(false);
      setMsg("Please sign in first.");
      window.location.href = `/login?upgrade=${plan}`;
      return;
    }

    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan, billing }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Checkout failed");

      if (json?.url) window.location.href = json.url;
      else throw new Error("Missing checkout URL");
    } catch (e: any) {
      setMsg(e?.message || "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b0e14", color: "#fff", padding: 24, fontFamily: "Inter,system-ui,sans-serif" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", paddingTop: 40 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>{title}</h1>
        <p style={{ color: "#9ca3af", marginTop: 8 }}>
          Choose billing and continue to Stripe Checkout.
        </p>

        <div style={{ marginTop: 20, background: "#111827", border: "1px solid #1f2937", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <button onClick={() => setBilling("monthly")} style={btnStyle(billing === "monthly")}>Monthly</button>
            <button onClick={() => setBilling("yearly")} style={btnStyle(billing === "yearly")}>Yearly</button>
            <button onClick={() => setBilling("lifetime")} style={btnStyle(billing === "lifetime")}>Lifetime</button>
          </div>

          <button
            onClick={startCheckout}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "none",
              background: "#4f46e5",
              color: "#fff",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Redirecting…" : "Continue to Checkout"}
          </button>

          {msg && <p style={{ marginTop: 12, color: "#fca5a5" }}>{msg}</p>}
        </div>

        <p style={{ color: "#6b7280", marginTop: 14, fontSize: 12 }}>
          Tip: you can bookmark: <code>/upgrade?plan={plan}</code>
        </p>
      </div>
    </div>
  );
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #1f2937",
    background: active ? "#0b0e14" : "#111827",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  };
}

