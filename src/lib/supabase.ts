import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

type SupabaseConfig = {
  url?: string;
  anonKey?: string;
  configured: boolean;
  urlPresent: boolean;
  anonKeyPresent: boolean;
};

function readEnvValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function safeUrlHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "Некорректный URL";
  }
}

export function getSupabaseConfig(): SupabaseConfig {
  const env = import.meta.env;

  const url =
    readEnvValue(env.VITE_SUPABASE_URL) ??
    readEnvValue(env.NEXT_PUBLIC_SUPABASE_URL);

  const anonKey =
    readEnvValue(env.VITE_SUPABASE_ANON_KEY) ??
    readEnvValue(env.VITE_SUPABASE_PUBLISHABLE_KEY) ??
    readEnvValue(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
    readEnvValue(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

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
    usingViteUrl: Boolean(readEnvValue(import.meta.env.VITE_SUPABASE_URL)),
    usingViteAnonKey: Boolean(
      readEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY) ??
        readEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
    ),
    usingNextPublicUrl: Boolean(readEnvValue(import.meta.env.NEXT_PUBLIC_SUPABASE_URL)),
    usingNextPublicAnonKey: Boolean(
      readEnvValue(import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
        readEnvValue(import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    ),
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV,
    prod: import.meta.env.PROD,
  });
}

export function isSupabaseConfigured() {
  return getSupabaseConfig().configured;
}

export function getSupabaseClient(): SupabaseClient {
  const { url, anonKey, configured, urlPresent, anonKeyPresent } = getSupabaseConfig();

  if (!configured || !url || !anonKey) {
    console.error("[Интеллекта][supabase] Supabase не настроен", {
      urlPresent,
      anonKeyPresent,
      viteUrlPresent: Boolean(readEnvValue(import.meta.env.VITE_SUPABASE_URL)),
      viteAnonKeyPresent: Boolean(readEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY)),
      vitePublishableKeyPresent: Boolean(readEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)),
      nextPublicUrlPresent: Boolean(readEnvValue(import.meta.env.NEXT_PUBLIC_SUPABASE_URL)),
      nextPublicAnonKeyPresent: Boolean(readEnvValue(import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)),
      nextPublicPublishableKeyPresent: Boolean(readEnvValue(import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)),
      note: "Ключи в консоль не выводятся. Для Vite разрешены VITE_* и NEXT_PUBLIC_* через vite.config.ts.",
    });

    throw new Error(
      "Supabase не настроен: проверьте переменные VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY или NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  if (!client) {
    console.info("[Интеллекта][supabase] Создаем Supabase client", {
      urlHost: safeUrlHost(url),
      anonKeyPresent: true,
    });

    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return client;
}

export const supabase = getSupabaseConfig().configured ? getSupabaseClient() : null;
