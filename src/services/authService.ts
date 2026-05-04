import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase";

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

  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("supabase is not configured") ||
    message.includes("vite_supabase")
  ) {
    return "Не удалось подключиться к сервису авторизации.";
  }

  return "Не удалось выполнить действие. Попробуйте позже.";
}

export async function signUpWithEmail(params: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
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

  if (error) throw error;

  const profile = data.user && data.session ? await getCurrentProfile(data.user.id) : null;

  return {
    user: data.user,
    session: data.session,
    profile,
  };
}

export async function signInWithEmail(params: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: params.email.trim(),
    password: params.password,
  });

  if (error) throw error;

  const profile = data.user && data.session ? await getCurrentProfile(data.user.id) : null;

  return {
    user: data.user,
    session: data.session,
    profile,
  };
}

export async function signOut() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function getCurrentProfile(userId?: string): Promise<AppProfile | null> {
  const supabase = getSupabaseClient();
  const id = userId ?? (await getCurrentUser())?.id;

  if (!id) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,name,role")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return mapProfile(data);
}

export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void,
) {
  const supabase = getSupabaseClient();
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return data.subscription;
}
