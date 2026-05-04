import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseConfig() {
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    url,
    anonKey,
    configured: Boolean(url && anonKey),
  };
}

export function isSupabaseConfigured() {
  return getSupabaseConfig().configured;
}

export function getSupabaseClient() {
  const { url, anonKey, configured } = getSupabaseConfig();

  if (!configured || !url || !anonKey) {
    throw new Error(
      "Supabase is not configured. For Vite, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    );
  }

  if (!client) {
    client = createClient(url, anonKey);
  }

  return client;
}

export const supabase = getSupabaseConfig().configured
  ? getSupabaseClient()
  : null;
