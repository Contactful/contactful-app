"use client";

import { FormEvent, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUrl =
    process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL ||
    "https://app.contactful.app/auth-complete";

  async function signInWithGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl },
    });
    if (error) setError(error.message);
  }

  async function signInWithEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectUrl },
    });

    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Sign in to Contactful</h1>

      <button onClick={signInWithGoogle}>Continue with Google</button>
      <hr />

      <form onSubmit={signInWithEmail}>
        <input
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit">Send magic link</button>
      </form>

      {sent && <p>📩 Check your inbox!</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
