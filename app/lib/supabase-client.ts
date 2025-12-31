import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Uwaga: ten plik jest importowany przez Client Components,
// więc NIE używamy process.env[name] (dynamicznie), tylko statycznie.

let browserClient: SupabaseClient | null = null;

export function supabaseBrowser() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");

  browserClient = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}

