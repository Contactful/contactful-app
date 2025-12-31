// app/lib/use-entitlements.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EntitlementsResponse } from "./entitlements-client";
import { fetchEntitlements, getAccessTokenFromSupabaseClient } from "./entitlements-client";
import { supabaseBrowser } from "./supabase-client";

type State =
  | { status: "idle"; entitlements: null; error: null }
  | { status: "loading"; entitlements: null; error: null }
  | { status: "ready"; entitlements: EntitlementsResponse; error: null }
  | { status: "error"; entitlements: null; error: string };

export function useEntitlements() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [state, setState] = useState<State>({
    status: "idle",
    entitlements: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState({ status: "loading", entitlements: null, error: null });

    try {
      const token = await getAccessTokenFromSupabaseClient(supabase);
      if (!token) {
        setState({ status: "error", entitlements: null, error: "Not logged in (no access token)" });
        return;
      }

      const ent = await fetchEntitlements(token);
      setState({ status: "ready", entitlements: ent, error: null });
    } catch (e: any) {
      setState({
        status: "error",
        entitlements: null,
        error: e?.message || "Failed to load entitlements",
      });
    }
  }, [supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...state,
    refresh,
  };
}

