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
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSignedIn(!!data?.session);
    })();
  }, []);

  function planLabel(p: Plan) {
    if (p === "talent") return "Talent Pack";
    if (p === "networking") return "Networking Pack";
    return "Bundle (Talent + Networking)";
  }

  async function startCheckout() {
    try {
      setLoading(true);
      setMsg(null);

      // 1) Pobierz aktualną sesję i token Supabase (to musi być SUPABASE JWT)
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;

      // 2) Jeśli brak sesji → wróć do login z kontekstem upgrade
      if (!accessToken) {
        window.location.replace(`/login?upgrade=${encodeURIComponent(plan)}`);
        return;
      }

      // 3) Wywołaj endpoint Stripe (backend tworzy Checkout i zwraca url)
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          plan,    // talent | networking | bundle
          billing, // monthly | yearly | lifetime
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        // najczęstsze: 401 Invalid access token (gdy token był zły) lub 400 (mapowanie ceny)
        throw new Error(json?.error || json?.message || "Checkout failed");
      }

      if (json?.url) {
        window.location.href = json.url;
        return;
      }

      throw new Error("No checkout URL returned from server");
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
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              style={btnStyle(billing === "monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              style={btnStyle(billing === "yearly")}
            >
              Yearly
            </button>
            <button
              type="button"
              onClick={() => setBilling("lifetime")}
              style={btnStyle(billing === "lifetime")}
            >
              Lifetime
            </button>
          </div>

          <div style={{ height: 14 }} />

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
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Redirecting…" : "Continue to Checkout"}
          </button>

          <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>
            Session:{" "}
            {signedIn === null ? "checking…" : signedIn ? "signed in ✅" : "not signed in ❌"}
          </div>

          {msg && <p style={{ marginTop: 12, color: "#fca5a5" }}>{msg}</p>}
        </div>

        <p style={{ color: "#6b7280", marginTop: 14, fontSize: 12 }}>
          Tip: you can bookmark: <code>/upgrade?plan={plan}</code>
        </p>

        <p style={{ marginTop: 10, fontSize: 12 }}>
          <a href={`/login?upgrade=${encodeURIComponent(plan)}`} style={{ color: "#818cf8" }}>
            Back to login
          </a>
          {"  "}·{"  "}
          <a href="/" style={{ color: "#818cf8" }}>
            Home
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
    fontWeight: 700,
  };
}

