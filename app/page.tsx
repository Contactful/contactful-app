"use client";

import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const handleUpgrade = async () => {
    // 1) Pobierz sesję (access_token)
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session?.access_token) {
      alert("Najpierw zaloguj się na /login");
      window.location.href = "/login";
      return;
    }

    // 2) Wywołaj backend Stripe (Bearer token)
    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ plan: "pro" }),
    });

    const out = await res.json();

    if (!res.ok) {
      console.error(out);
      alert(out?.error || "Stripe API error");
      return;
    }

    // 3) Redirect do Stripe Checkout
    if (out?.url) window.location.href = out.url;
    else alert("No checkout URL returned");
  };

  return (
    <main style={{ padding: 40 }}>
      <h1>Contactful – Upgrade</h1>
      <p>Test flow: login → checkout</p>

      <button onClick={handleUpgrade} style={{ padding: "12px 16px" }}>
        Upgrade to PRO
      </button>
    </main>
  );
}

