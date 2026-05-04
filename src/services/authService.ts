import type { AuthError, Session, User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabaseClient, logSupabaseConfigState } from "../lib/supabase";

export type UserRole = "user" | "admin";

export type AppProfile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export type AuthResult = {
  user: SupabaseUser | null;
  session: Session | null;
  profile: AppProfile | null;
};

type DebugPayload = Record<string, unknown>;

function debugInfo(message: string, payload?: DebugPayload) {
  console.info(`[Интеллекта][auth] ${message}`, payload ?? {});
}

function debugWarn(message: string, payload?: DebugPayload) {
  console.warn(`[Интеллекта][auth] ${message}`, payload ?? {});
}

function debugError(message: string, error: unknown, payload?: DebugPayload) {
  const authError = error as Partial<AuthError> | null;
  console.error(`[Интеллекта][auth] ${message}`, {
    ...payload,
    errorName: error instanceof Error ? error.name : undefined,
    errorMessage: error instanceof Error ? error.message : String(error ?? ""),
    supabaseStatus: authError?.status,
    supabaseCode: authError?.code,
  });
}

function mapProfile(row: unknown): AppProfile | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  const role = value.role === "admin" ? "admin" : "user";
  return {
    id: String(value.id ?? ""),
    email: String(value.email ?? ""),
    name: String(value.name ?? value.email ?? "Пользователь"),
    role,
  };
}

export function getAuthErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "");
  const message = rawMessage.toLowerCase();

  if (message.includes("invalid login credentials") || message.includes("invalid credentials")) {
    return "Неверный email или пароль.";
  }

  if (message.includes("already registered") || message.includes("user already registered") || message.includes("already exists")) {
    return "Пользователь с таким email уже существует.";
  }

  if (message.includes("email not confirmed") || message.includes("not confirmed")) {
    return "Подтвердите email, чтобы войти.";
  }

  if (message.includes("supabase is not configured") || message.includes("vite_supabase")) {
    return "Supabase не настроен: проверьте переменные VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в Vercel.";
  }

  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Не удалось подключиться к сервису авторизации. Подробности смотрите в Console и Network.";
  }

  return "Не удалось выполнить действие. Попробуйте позже.";
}

export async function signUpWithEmail(params: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  debugInfo("signUp:start", { email: params.email.trim(), namePresent: Boolean(params.name.trim()) });
  logSupabaseConfigState("auth:signUp");

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: params.email.trim(),
      password: params.password,
      options: {
        data: {
          name: params.name.trim(),
        },
      },
    });

    if (error) {
      debugError("signUp:error-from-supabase", error, { email: params.email.trim() });
      throw error;
    }

    debugInfo("signUp:success", {
      userId: data.user?.id ?? null,
      userEmail: data.user?.email ?? null,
      sessionReturned: Boolean(data.session),
      requiresEmailConfirmation: !data.session,
    });

    const profile = data.user && data.session ? await getCurrentProfile(data.user.id) : null;

    return {
      user: data.user,
      session: data.session,
      profile,
    };
  } catch (error) {
    debugError("signUp:failed", error, { email: params.email.trim() });
    throw error;
  }
}

export async function signInWithEmail(params: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  debugInfo("signIn:start", { email: params.email.trim() });
  logSupabaseConfigState("auth:signIn");

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: params.email.trim(),
      password: params.password,
    });

    if (error) {
      debugError("signIn:error-from-supabase", error, { email: params.email.trim() });
      throw error;
    }

    debugInfo("signIn:success", {
      userId: data.user?.id ?? null,
      userEmail: data.user?.email ?? null,
      sessionReturned: Boolean(data.session),
    });

    const profile = data.user && data.session ? await getCurrentProfile(data.user.id) : null;

    return {
      user: data.user,
      session: data.session,
      profile,
    };
  } catch (error) {
    debugError("signIn:failed", error, { email: params.email.trim() });
    throw error;
  }
}

export async function signOut() {
  debugInfo("signOut:start");
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      debugError("signOut:error-from-supabase", error);
      throw error;
    }
    debugInfo("signOut:success");
  } catch (error) {
    debugError("signOut:failed", error);
    throw error;
  }
}

export async function getCurrentSession() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      debugError("getSession:error-from-supabase", error);
      throw error;
    }
    debugInfo("getSession:success", { hasSession: Boolean(data.session), userId: data.session?.user?.id ?? null });
    return data.session;
  } catch (error) {
    debugError("getSession:failed", error);
    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      debugError("getUser:error-from-supabase", error);
      throw error;
    }
    debugInfo("getUser:success", { userId: data.user?.id ?? null, userEmail: data.user?.email ?? null });
    return data.user;
  } catch (error) {
    debugError("getUser:failed", error);
    throw error;
  }
}

export async function getCurrentProfile(userId?: string): Promise<AppProfile | null> {
  const supabase = getSupabaseClient();
  const id = userId ?? (await getCurrentUser())?.id;

  if (!id) {
    debugWarn("getProfile:skip-no-user-id");
    return null;
  }

  debugInfo("getProfile:start", { userId: id });

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,name,role")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    debugError("getProfile:error-from-supabase", error, { userId: id });
    throw error;
  }

  debugInfo("getProfile:success", {
    userId: id,
    profileFound: Boolean(data),
    role: data?.role ?? null,
  });

  return mapProfile(data);
}

export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void,
) {
  const supabase = getSupabaseClient();
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    debugInfo("onAuthStateChange", {
      event,
      hasSession: Boolean(session),
      userId: session?.user?.id ?? null,
      userEmail: session?.user?.email ?? null,
    });
    callback(event, session);
  });

  return data.subscription;
}
