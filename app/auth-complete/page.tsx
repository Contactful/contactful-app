"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type UpgradePlan = "talent" | "networking" | "bundle";

export default function AuthCompletePage() {
  const [message, setMessage] = useState("Finalizing sign-in…");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // poczekaj aż Supabase zapisze sesję po callbacku
      await new Promise((r) => setTimeout(r, 150));

      const { data } = await supabase.auth.getSession();

      // wyciągnij upgrade z URL (najpewniejsze)
      const urlUpgrade = new URLSearchParams(window.location.search).get("upgrade");
      const upgradeFromUrl =
        urlUpgrade === "talent" || urlUpgrade === "networking" || urlUpgrade === "bundle"
          ? (urlUpgrade as UpgradePlan)
          : null;

      // fallback na localStorage
      const lsUpgrade = localStorage.getItem("contactful_upgrade");
      const upgradeFromLs =
        lsUpgrade === "talent" || lsUpgrade === "networking" || lsUpgrade === "bundle"
          ? (lsUpgrade as UpgradePlan)
          : null;

      const upgrade = upgradeFromUrl || upgradeFromLs;

      // zawsze czyścimy URL do stabilnego (bez # i bez query)
      const cleanUrl = `${window.location.origin}/auth-complete`;
      window.history.replaceState({}, document.title, cleanUrl);

      if (cancelled) return;

      if (data?.session) {
        setMessage("Logged in ✅ Redirecting…");

        if (upgrade) {
          // zostaw w localStorage na wszelki wypadek
          localStorage.setItem("contactful_upgrade", upgrade);
          window.location.replace(`/upgrade?plan=${encodeURIComponent(upgrade)}`);
          return;
        }

        window.location.replace(`/`);
        return;
      }

      setMessage("Login not completed. Please go back to /login.");
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ padding: 40, fontFamily: "Inter,system-ui,sans-serif" }}>
      <h1>Contactful</h1>
      <p>{message}</p>
      <p style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
        If you’re stuck, go back to <a href="/login">/login</a>.
      </p>
    </main>
  );
}

