"use client";

import { supabaseBrowser } from "@/app/lib/supabase-client";

export default function SignOutButton() {
  return (
    <button
      className="cf-btn"
      onClick={async () => {
        const sb = supabaseBrowser();
        await sb.auth.signOut();
        window.location.href = "/login";
      }}
      type="button"
    >
      Sign out
    </button>
  );
}
