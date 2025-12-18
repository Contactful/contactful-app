import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,          // 🔴 KLUCZOWE
    autoRefreshToken: true,        // 🔴 KLUCZOWE
    detectSessionInUrl: true,      // 🔴 KLUCZOWE (OAuth + magic link)
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

