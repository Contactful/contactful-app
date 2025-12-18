"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AuthCompletePage() {
  const [msg, setMsg] = useState("Completing sign-in…");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();

      if (data?.session) {
        setMsg("Logged in ✅ You can close this tab.");

        // usuń # i query params z URL
        const cleanUrl = window.location.origin + "/auth-complete";
        window.history.replaceState({}, document.title, cleanUrl);
        return;
      }

      setMsg("Login not completed. Please try again.");
      const cleanUrl = window.location.origin + "/auth-complete";
      window.history.replaceState({}, document.title, cleanUrl);
    })();
  }, []);

  return (
    <main style={{ padding: 40 }}>
      <h1>Contactful</h1>
      <p>{msg}</p>
    </main>
  );
}

