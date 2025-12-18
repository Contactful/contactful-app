"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AuthCompletePage() {
  const [message, setMessage] = useState("Finalizing sign-in…");

  useEffect(() => {
    let cancelled = false;

    const completeAuth = async () => {
      // 1️⃣ Daj Supabase chwilę na zapisanie sesji po OAuth / Magic Link
      await new Promise((r) => setTimeout(r, 150));

      const { data, error } = await supabase.auth.getSession();

      // 2️⃣ Zawsze czyścimy URL (usuwamy #access_token itd.)
      const cleanUrl = `${window.location.origin}/auth-complete`;
      window.history.replaceState({}, document.title, cleanUrl);

      if (cancelled) return;

      if (error) {
        setMessage("Login failed. Please try again.");
        return;
      }

      // 3️⃣ Jeśli sesja istnieje → decydujemy co dalej
      if (data?.session) {
        setMessage("Logged in ✅ Redirecting…");

        const upgrade = localStorage.getItem("contactful_upgrade");

        if (upgrade) {
          // user przyszedł po upgrade
          window.location.replace(
            `/upgrade?plan=${encodeURIComponent(upgrade)}`
          );
          return;
        }

        // standardowy login (bez upgrade)
        window.location.replace("/");
        return;
      }

      // 4️⃣ Fallback (bardzo rzadki)
      setMessage("Login not completed. Please go back to login.");
    };

    completeAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        background: "#0b0e14",
        color: "#fff",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ marginBottom: 12 }}>Contactful</h1>
        <p>{message}</p>

        <p style={{ marginTop: 16, fontSize: 12, color: "#9ca3af" }}>
          If nothing happens, go back to{" "}
          <a href="/login" style={{ color: "#818cf8" }}>
            /login
          </a>
        </p>
      </div>
    </main>
  );
}

