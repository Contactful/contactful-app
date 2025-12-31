// app/lib/entitlements-client.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "./pricing";

export type EntitlementsResponse = {
  user_id: string;
  entitlements: {
    networking: boolean;
    talent: boolean;
    bundle: boolean;
  };
  subscriptions: Array<{
    plan: Plan;
    billing?: string | null;
    status?: string | null;
    current_period_end?: string | null;
  }>;
};

export async function getAccessTokenFromSupabaseClient(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

export async function fetchEntitlements(accessToken: string): Promise<EntitlementsResponse> {
  const res = await fetch("/api/me/entitlements", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json as EntitlementsResponse;
}

