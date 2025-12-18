"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Plan = "talent" | "networking" | "bundle";
type Billing = "monthly" | "yearly" | "lifetime";

export default function UpgradePage() {
  const plan = useMemo<Plan>(() => {
    if (typeof window === "undefined") return "talent";
    const p = new URLSearchParams(window.location.search).get("plan");
    if (p === "talent" || p === "networking" || p === "bundle") return p;
    return "talent";
  }, []);

  const [billing, setBilling] = useState<Billing>("monthly");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Debug info widoczne na stronie (bez konsoli)
  const [debug, setDebug] = useState<string>("");

  useEffect(() => {
    // jeśli plan trafił tu z /auth-complete, utrzymujemy go jako kontekst
    localStorage.setItem("contactful_upgrade", plan);
  }, [plan]);

  function planLabel(p: Plan) {
    if (p === "talent") return "Talent Pack";
    if (p === "networking") return "Networking Pack";
    return "Bundle (Talent + Networking)";
  }

  async function debugSession() {
    try {
      const { data } = await supabase.auth.getSession();
      const t = data?.session?.access_token;

      if (!t) {
        setDebug("NO SESSION / NO access_token");
        return;
      }

      const parts = t.split(".");
      if (parts.length !== 3) {
        setDebug(`TOKEN NOT JWT (parts=${parts.length})`);
        return;
      }

      const payload = JSON.parse(atob(parts[1]));
      setDebug(`JWT OK | iss=${payload.iss} | sub=${payload.sub}`);
    } catch (e: any) {
      setDebug(`DEBUG ERROR: ${e?.message || String(e)}`);
    }
  }

  async function startCheckout() {
    try {
      setLoading(true);
      setMsg(null);

      // 1) weź token z aktywnej sesji Supabase (to musi być Supabase JWT)
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;

      if (!accessToken) {
        window.location.replace(`/login?upgrade=${encodeURIComponent(plan)}`);
        return;
      }

      // 2) call API
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ plan, billing }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || json?.details || "Checkout failed");
      }

      if (json?.url) {
        window.location.href = json.url;
        return;
      }

      throw new Error("No checkout URL returned");
    } catch (e: any) {
      setMsg(e?.message || "Checkout error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0e14",
        color: "#fff",
        padding: 24,
        fontFamily: "Inter,system-ui,sans-serif",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto", paddingTop: 40 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Upgrade</h1>
        <p style={{ color: "#9ca3af", marginTop: 8 }}>
          Selected plan: <b>{planLabel(plan)}</b>
        </p>

        <div
          style={{
            marginTop: 18,
            background: "#111827",
            border: "1px solid #1f2937",
            borderRadius: 14,
            padding: 16,
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setBilling("monthly")} style={btnStyle(billing === "monthly")}>
              Monthly
            </button>
            <button type="button" onClick={() => setBilling("yearly")} style={btnStyle(billing === "yearly")}>
              Yearly
            </button>
            <button type="button" onClick={() => setBilling("lifetime")} style={btnStyle(billing === "lifetime")}>
              Lifetime
            </button>
          </div>

          <div style={{ height: 12 }} />

          <button
            type="button"
            onClick={debugSession}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #1f2937",
              background: "#0b0e14",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              marginBottom: 10,
            }}
          >
            Debug session
          </button>

          {debug && (
            <p style={{ marginTop: 0, marginBottom: 10, color: "#9ca3af", fontSize: 12 }}>
              {debug}
            </p>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              startCheckout();
            }}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "none",
              background: "#4f46e5",
              color: "#fff",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Redirecting…" : "Continue to Checkout"}
          </button>

          {msg && <p style={{ marginTop: 12, color: "#fca5a5" }}>{msg}</p>}
        </div>

        <p style={{ color: "#6b7280", marginTop: 14, fontSize: 12 }}>
          Tip: bookmark: <code>/upgrade?plan={plan}</code>
        </p>

        <p style={{ marginTop: 10, fontSize: 12 }}>
          <a href={`/login?upgrade=${encodeURIComponent(plan)}`} style={{ color: "#818cf8" }}>
            Back to login
          </a>
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
    fontWeight: 800,
  };
}

