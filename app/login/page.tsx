k"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "google" | "magic">(null);

  const upgrade = useMemo(() => {
    if (typeof window === "undefined") return null;
    const u = new URLSearchParams(window.location.search).get("upgrade");
    if (u === "talent" || u === "networking" || u === "bundle") return u;
    return null;
  }, []);

  useEffect(() => {
    // Jeśli user już ma sesję, idziemy prosto dalej
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        if (upgrade) {
          localStorage.setItem("contactful_upgrade", upgrade);
          window.location.replace(`/upgrade?plan=${encodeURIComponent(upgrade)}`);
        } else {
          window.location.replace(`/`);
        }
      }
    })();
  }, [upgrade]);

  async function signInWithGoogle() {
    setError(null);
    setStatus(null);
    setBusy("google");

    try {
      if (upgrade) localStorage.setItem("contactful_upgrade", upgrade);

      const redirectTo = `${window.location.origin}/auth-complete`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (error) setError(error.message);
    } catch (e: any) {
      setError(e?.message || "Google sign-in failed");
    } finally {
      setBusy(null);
    }
  }

  async function signInWithMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setBusy("magic");

    try {
      if (!email || !email.includes("@")) {
        setError("Enter a valid email address.");
        return;
      }

      if (upgrade) localStorage.setItem("contactful_upgrade", upgrade);

      const emailRedirectTo = `${window.location.origin}/auth-complete`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });

      if (error) {
        setError(error.message);
        return;
      }

      setStatus("Magic link sent. Check your inbox.");
    } catch (e: any) {
      setError(e?.message || "Magic link sign-in failed");
    } finally {
      setBusy(null);
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
      <div style={{ maxWidth: 520, margin: "0 auto", paddingTop: 40 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Contactful</h1>
        <p style={{ color: "#9ca3af", marginTop: 8 }}>
          Sign in to unlock features{upgrade ? ` (upgrade: ${upgrade})` : ""}.
        </p>

        <div
          style={{
            marginTop: 20,
            background: "#111827",
            border: "1px solid #1f2937",
            borderRadius: 14,
            padding: 16,
          }}
        >
          <button
            onClick={signInWithGoogle}
            disabled={busy !== null}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #1f2937",
              background: "#0b0e14",
              color: "#fff",
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy === "google" ? "Redirecting…" : "Continue with Google"}
          </button>

          <div style={{ height: 14 }} />

          <form onSubmit={signInWithMagicLink}>
            <label style={{ display: "block", fontSize: 12, color: "#9ca3af" }}>
              Email (magic link)
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              type="email"
              style={{
                width: "100%",
                marginTop: 8,
                padding: "12px 12px",
                borderRadius: 10,
                border: "1px solid #1f2937",
                background: "#0b0e14",
                color: "#fff",
                outline: "none",
              }}
            />

            <button
              type="submit"
              disabled={busy !== null}
              style={{
                width: "100%",
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 10,
                border: "none",
                background: "#4f46e5",
                color: "#fff",
                fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy === "magic" ? "Sending…" : "Send magic link"}
            </button>
          </form>

          {status && <p style={{ marginTop: 12, color: "#86efac" }}>{status}</p>}
          {error && <p style={{ marginTop: 12, color: "#fca5a5" }}>{error}</p>}
        </div>

        <p style={{ color: "#6b7280", marginTop: 14, fontSize: 12 }}>
          After sign-in, you’ll be redirected automatically.
        </p>
      </div>
    </div>
  );
}

