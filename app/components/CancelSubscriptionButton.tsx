"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/app/lib/supabase-client";

export default function CancelSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    try {
      setLoading(true);

      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      if (!token) {
        alert("Not authenticated");
        window.location.href = "/login";
        return;
      }

      const r = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ returnPath: "/" }),
      });

      const txt = await r.text().catch(() => "");
      if (!r.ok) throw new Error(txt || `Portal ${r.status}`);

      const json = JSON.parse(txt || "{}");
      if (!json?.url) throw new Error("Missing portal URL");

      window.location.href = json.url;
    } catch (e: any) {
      alert(e?.message || "Not authenticated");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={openPortal}
      disabled={loading}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-600/25 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
      title="Cancel subscription"
      aria-label="Cancel subscription"
    >
      ×
    </button>
  );
}

