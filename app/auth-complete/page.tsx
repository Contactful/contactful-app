"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AuthCompletePage() {
  const [msg, setMsg] = useState("Completing sign-in…");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Daj Supabase chwilę na zakończenie wewnętrznego „cleanup” URL
      await new Promise((r) => setTimeout(r, 80));

      const { data } = await supabase.auth.getSession();

      if (cancelled) return;

      // Zawsze czyścimy URL do stabilnej postaci (bez #)
      const cleanUrl = window.location.origin + "/auth-complete";
      window.history.replaceState({}, document.title, cleanUrl);

      if (data?.session) {
        setMsg("Logged in ✅ Redirecting…");

        const upgrade = localStorage.getItem("contactful_upgrade");
        if (upgrade) {
          window.location.replace(`/upgrade?plan=${encodeURIComponent(upgrade)}`);
          return;
        }

        window.location.replace(`/`);
        return;
      }

      setMsg("Login not completed. Please try again.");
      // zostaw na stronie – user może wrócić do /login
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ padding: 40, fontFamily: "Inter,system-ui,sans-serif" }}>
      <h1>Contactful</h1>
      <p>{msg}</p>
      <p style={{ marginTop: 12, color: "#6b7280", fontSize: 12 }}>
        If you’re stuck, go back to <a href="/login">/login</a>.
      </p>
    </main>
  );
}

