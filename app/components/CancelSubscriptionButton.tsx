"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/app/lib/supabase-client";

export default function CancelSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      title="Cancel / manage subscription"
      aria-label="Cancel / manage subscription"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const supabase = supabaseBrowser();
          const { data } = await supabase.auth.getSession();
          const token = data?.session?.access_token;

          if (!token) {
            window.location.href = "/login";
            return;
          }

          const r = await fetch("/api/stripe/portal", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${token}`,
            },
          });

          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j?.url) throw new Error(j?.details || j?.error || "Portal failed");
          window.location.href = j.url;
        } catch (e) {
          console.error(e);
          alert("Could not open subscription portal.");
        } finally {
          setLoading(false);
        }
      }}
      className="mt-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
    >
      ✕
    </button>
  );
}

