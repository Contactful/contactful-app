"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setError(null);
    setStatus(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth-complete`,
      },
    });

    if (error) setError(error.message);
  }

  async function signInWithMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);

    if (!email) {
      setError("Enter your email address");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth-complete`,
      },
    });

    if (error) setError(error.message);
    else setStatus("Magic link sent. Check your inbox.");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(1200px at 10% 10%, #1a1f2b, #0b0e14)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        color: "#fff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#111827",
          borderRadius: 14,
          padding: 32,
          boxShadow: "0 20px 60px rgba(0,0,0,.6)",
        }}
      >
        {/* Logo / Brand */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
            Contactful
          </h1>
          <p style={{ marginTop: 8, color: "#9ca3af", fontSize: 14 }}>
            Sign in to manage your contacts and unlock PRO features
          </p>
        </div>

        {/* Google */}
        <button
          onClick={signInWithGoogle}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #1f2937",
            background: "#0b0e14",
            color: "#fff",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Continue with Google
        </button>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: "24px 0",
            color: "#6b7280",
            fontSize: 12,
          }}
        >
          <div style={{ flex: 1, height: 1, background: "#1f2937" }} />
          OR
          <div style={{ flex: 1, height: 1, background: "#1f2937" }} />
        </div>

        {/* Magic link */}
        <form onSubmit={signInWithMagicLink}>
          <label style={{ fontSize: 13, color: "#9ca3af" }}>
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            style={{
              width: "100%",
              marginTop: 6,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #1f2937",
              background: "#0b0e14",
              color: "#fff",
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              width: "100%",
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 10,
              border: "none",
              background: "#4f46e5",
              color: "#fff",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Send magic link
          </button>
        </form>

        {/* Status / error */}
        {status && (
          <p style={{ marginTop: 14, color: "#10b981", fontSize: 13 }}>
            {status}
          </p>
        )}
        {error && (
          <p style={{ marginTop: 14, color: "#ef4444", fontSize: 13 }}>
            {error}
          </p>
        )}

        {/* Footer */}
        <p
          style={{
            marginTop: 24,
            fontSize: 12,
            color: "#6b7280",
            textAlign: "center",
          }}
        >
          By signing in you agree to Contactful terms & privacy policy.
        </p>
      </div>
    </div>
  );
}

