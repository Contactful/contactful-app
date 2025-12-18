"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type UpgradePlan = "talent" | "networking" | "bundle";

export default function AuthCompletePage() {
  const [message, setMessage] = useState("Finalizing sign-in…");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const url = new URL(window.location.href);

        // 1) PKCE: wymień ?code=... na sesję (KLUCZOWE)
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // 2) Odczytaj sesję
        const { data } = await supabase.auth.getSession();

        // 3) Upgrade z URL albo z localStorage
        const u = url.searchParams.get("upgrade");
        const upgradeFromUrl =
          u === "talent" || u === "networking" || u === "bundle"
            ? (u as UpgradePlan)
            : null;

        const ls = localStorage.getItem("contactful_upgrade");
        const upgradeFromLs =
          ls === "talent" || ls === "networking" || ls === "bundle"
            ? (ls as UpgradePlan)
            : null;

        const upgrade = upgradeFromUrl || upgradeFromLs;

        // 4) Wyczyść URL (usuń code/upgrade i hash)
        const cleanUrl = `${window.location.origin}/auth-complete`;
        window.history.replaceState({}, document.title, cleanUrl);

        if (cancelled) return;

        if (data?.session) {
          setMessage("Logged in ✅ Redirecting…");

          if (upgrade) {
            localStorage.setItem("contactful_upgrade", upgrade);
            window.location.replace(`/upgrade?plan=${encodeURIComponent(upgrade)}`);
            return;
          }

          window.location.replace(`/`);
          return;
        }

        setMessage("Login not completed. Please go back to /login.");
      } catch (e: any) {
        if (cancelled) return;
        setMessage(e?.message ? `Auth error: ${e.message}` : "Auth error. Please try again.");
      }
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
    </main>
  );
}

