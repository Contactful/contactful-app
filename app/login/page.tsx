"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "../lib/supabase-client";

const LOGO_URL =
  "https://contactful.app/wp-content/uploads/2025/11/Contactful.app-logo.png";

export default function LoginPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/`;
  }, []);

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-start justify-center py-8">
      <div className="w-full max-w-xl">
        <div className="cf-card p-6 sm:p-8">
          {/* Logo */}
          <div className="flex items-center justify-center mb-4">
            {/* zwykły img, żeby nie bawić się w next/image domains */}
            <img
              src={LOGO_URL}
              alt="Contactful"
              className="h-9 w-auto object-contain"
            />
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 text-center">
            Sign in
          </h1>
          <p className="mt-2 text-slate-600 text-center">
            Log in to access your Contactful account.
          </p>

          {/* Card inner */}
          <div className="mt-6 space-y-4">
            {/* Google OAuth */}
            <button
              disabled={loadingGoogle}
              onClick={async () => {
                setErr(null);
                setLoadingGoogle(true);
                try {
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                      redirectTo,
                      // queryParams: { prompt: "select_account" },
                    },
                  });
                  if (error) throw error;
                } catch (e: any) {
                  setErr(e?.message ?? String(e));
                  setLoadingGoogle(false);
                }
              }}
              className={[
                "w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                "border-slate-600/25 bg-white hover:bg-slate-50",
                "text-slate-800 shadow-[0_10px_25px_rgba(15,23,42,0.06)]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center justify-center gap-3",
                "focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:ring-offset-2 focus:ring-offset-white",
              ].join(" ")}
            >
              <GoogleIcon />
              {loadingGoogle ? "Redirecting…" : "Continue with Google"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-slate-200" />
              <div className="text-xs font-medium text-slate-500">or</div>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Magic link */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErr(null);
                setSent(false);
                setLoadingMagic(true);
                try {
                  const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: { emailRedirectTo: redirectTo },
                  });
                  if (error) throw error;
                  setSent(true);
                } catch (e: any) {
                  setErr(e?.message ?? String(e));
                } finally {
                  setLoadingMagic(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-600">
                  Email (magic link)
                </label>
                <input
                  placeholder="you@company.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={[
                    "mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none transition",
                    "border-slate-600/25 bg-white text-slate-900 placeholder:text-slate-400",
                    "focus:ring-2 focus:ring-violet-500/35 focus:border-violet-500/40",
                  ].join(" ")}
                />
              </div>

              <button
                type="submit"
                disabled={loadingMagic || !email}
                className={[
                  "w-full rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  "bg-violet-600 text-white hover:bg-violet-700",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:ring-offset-2 focus:ring-offset-white",
                ].join(" ")}
              >
                {loadingMagic ? "Sending…" : "Send magic link"}
              </button>

              {sent ? (
                <div className="rounded-2xl border border-emerald-600/25 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Link sent. Check your inbox.
                </div>
              ) : null}
            </form>

            {err ? (
              <div className="rounded-2xl border border-rose-600/25 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {err}
              </div>
            ) : null}

            <div className="pt-1 flex items-center justify-center">
              <Link
                href="/"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                ← Back
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-slate-500">
          Tip: bookmark <span className="font-mono text-slate-600">/login</span>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 6 .9 8.3 2.7l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.1-.1-2.2-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.2 19 12 24 12c3.1 0 6 .9 8.3 2.7l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8.2l-6.6 5.1C9.5 39.5 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1 2.7-3 4.9-5.7 6.3l6.3 5.2C39.7 36.4 44 31 44 24c0-1.1-.1-2.2-.4-3.5z"
      />
    </svg>
  );
}

