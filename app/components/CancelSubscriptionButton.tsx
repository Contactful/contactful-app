"use client";

import { useState } from "react";

export default function CancelSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  async function go() {
    try {
      setLoading(true);

      const r = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || j?.details || "Portal failed");
      if (!j?.url) throw new Error("Missing portal url");

      window.location.href = j.url;
    } catch (e: any) {
      alert(e?.message || "Cancel failed");
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={loading}
      title="Cancel subscription"
      aria-label="Cancel subscription"
      className={[
        "ml-2 inline-flex items-center justify-center",
        "h-6 w-6 rounded-full",
        "border border-red-600/30 bg-red-50 text-red-700",
        "hover:bg-red-100 transition",
        "text-sm leading-none font-bold",
        "disabled:opacity-60 disabled:cursor-not-allowed",
      ].join(" ")}
    >
      {loading ? "…" : "×"}
    </button>
  );
}

