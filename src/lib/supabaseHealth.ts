import { getSupabaseConfig } from "./supabase";

export function getSupabaseHealth() {
  const config = getSupabaseConfig();

  return {
    configured: config.configured,
    urlPresent: Boolean(config.url),
    anonKeyPresent: Boolean(config.anonKey),
    message: config.configured
      ? "Supabase настроен"
      : "Supabase не настроен: проверьте VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY или NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY",
  };
}
