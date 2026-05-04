import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseConfig() {
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return {
    url,
    anonKey,
    configured: Boolean(url && anonKey),
    urlPresent: Boolean(url),
    anonKeyPresent: Boolean(anonKey),
  };
}

export function logSupabaseConfigState(source = "supabase") {
  const config = getSupabaseConfig();
  console.info(`[Интеллекта][${source}] Supabase config`, {
    configured: config.configured,
    urlPresent: config.urlPresent,
    anonKeyPresent: config.anonKeyPresent,
    urlHost: config.url ? safeUrlHost(config.url) : null,
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV,
    prod: import.meta.env.PROD,
  });
}

function safeUrlHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "Некорректный URL";
  }
}

export function isSupabaseConfigured() {
  return getSupabaseConfig().configured;
}

export function getSupabaseClient() {
  const { url, anonKey, configured, urlPresent, anonKeyPresent } = getSupabaseConfig();

  if (!configured || !url || !anonKey) {
    console.error("[Интеллекта][supabase] Supabase не настроен", {
      urlPresent,
      anonKeyPresent,
      expectedVariables: [
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      ],
      note: "В Vite дополнительно разрешен префикс NEXT_PUBLIC_ через vite.config.ts. Ключи в консоль не выводятся.",
    });

    throw new Error(
      "Supabase is not configured. For Vite, add VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  if (!client) {
    console.info("[Интеллекта][supabase] Создаем Supabase client", {
      urlHost: safeUrlHost(url),
      anonKeyPresent: true,
    });
    client = createClient(url, anonKey);
  }

  return client;
}

export const supabase = getSupabaseConfig().configured
  ? getSupabaseClient()
  : null;
