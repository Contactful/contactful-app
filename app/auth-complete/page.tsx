"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AuthCompletePage() {
  const [status, setStatus] = useState("Finishing login...");

  useEffect(() => {
    async function finalize() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setStatus("Error finishing login. You can close this tab.");
        return;
      }

      if (data?.session) {
        setStatus("Logged in. You can close this tab.");
      } else {
        setStatus("No active session. You can close this tab.");
      }
    }

    finalize();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ padding: 32, borderRadius: 16, border: "1px solid #333" }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>Auth complete</h1>
        <p>{status}</p>
      </div>
    </div>
  );
}
