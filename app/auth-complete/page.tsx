"use client";

import { useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AuthCompletePage() {
  useEffect(() => {
    let cancelled = false;

    const finishAuth = async () => {
      // czekamy aż Supabase skończy swoje wewnętrzne czyszczenie URL
      await new Promise((r) => setTimeout(r, 50));

      const { data } = await supabase.auth.getSession();

      if (cancelled) return;

      // BEZWARUNKOWO czyścimy URL (hash + query)
      const cleanUrl = window.location.origin + "/auth-complete";
      window.history.replaceState({}, document.title, cleanUrl);
    };

    finishAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ padding: 40 }}>
      <h1>Contactful</h1>
      <p>Logged in ✅ You can close this tab.</p>
    </main>
  );
}

