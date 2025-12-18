k"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type UpgradePlan = "talent" | "networking" | "bundle";

export default function AuthCompletePage() {
  const [message, setMessage] = useState("Finalizing sign-in…");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // 1) Jeśli wróciliśmy z OAuth z ?code=..., to WYMIENIAMY kod na sesję i zapisujemy ją
        // (to jest kluczowe, żeby /upgrade miało session/access_token)
        const hasCode = typeof window !== "undefined" && window.location.search.includes("code=");
        if (hasCode) {
          await supabase.auth.exchangeCodeForSession(window.location.href);
        }

        // 2) Pobieramy sesję
        const { data } = await supabase.auth.getSession();

        // 3) Upgrade bierzemy z URL (pewne) albo z localStorage (fallback)
        const urlUpgrade = new URLSearchParams(window.location.search).get("upgrade");
        const upgradeFromUrl =
          urlUpgrade === "talent" || urlUpgrade === "networking" || urlUpgrade === "bundle"
            ? (urlUpgrade as UpgradePlan)
            : null;

        const lsUpgrade = localStorage.getItem("contactful_upgrade");
        const upgradeFromLs =
          lsUpgrade === "talent" || lsUpgrade === "networking" || lsUpgrade === "bundle"
            ? (lsUpgrade as UpgradePlan)
            : null;

        const upgrade = upgradeFromUrl || upgradeFromLs;

        // 4) Czyścimy URL (usuwa ?code= i #)
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

