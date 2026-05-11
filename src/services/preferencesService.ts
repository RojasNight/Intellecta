import { getSupabaseClient } from "../lib/supabase";

export interface UserPreferences {
  userId: string;
  genres: string[];
  topics: string[];
  goals: string[];
  complexityMin: number;
  complexityMax: number;
  excludedGenres: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UserPreferencesRow {
  user_id: string;
  genres: unknown;
  topics: unknown;
  goals: unknown;
  complexity_min: number | null;
  complexity_max: number | null;
  excluded_genres: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UpdateUserPreferencesInput {
  genres: string[];
  topics: string[];
  goals: string[];
  complexityMin: number;
  complexityMax: number;
  excludedGenres: string[];
}

type UserPreferencesDbInput = {
  user_id: string;
  genres: string[];
  topics: string[];
  goals: string[];
  complexity_min: number;
  complexity_max: number;
  excluded_genres: string[];
};

const DEFAULT_COMPLEXITY_MIN = 1;
const DEFAULT_COMPLEXITY_MAX = 5;

function uniqueCleanStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizeComplexity(value: unknown, fallback: number): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(5, Math.max(1, Math.round(numberValue)));
}

function normalizeInput(input: UpdateUserPreferencesInput): UpdateUserPreferencesInput {
  const complexityMin = normalizeComplexity(input.complexityMin, DEFAULT_COMPLEXITY_MIN);
  const complexityMax = normalizeComplexity(input.complexityMax, DEFAULT_COMPLEXITY_MAX);

  return {
    genres: uniqueCleanStrings(input.genres),
    topics: uniqueCleanStrings(input.topics),
    goals: uniqueCleanStrings(input.goals),
    complexityMin: Math.min(complexityMin, complexityMax),
    complexityMax: Math.max(complexityMin, complexityMax),
    excludedGenres: uniqueCleanStrings(input.excludedGenres),
  };
}

function toRow(data: unknown): UserPreferencesRow | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (typeof row.user_id !== "string") return null;

  return {
    user_id: row.user_id,
    genres: row.genres,
    topics: row.topics,
    goals: row.goals,
    complexity_min: typeof row.complexity_min === "number" ? row.complexity_min : null,
    complexity_max: typeof row.complexity_max === "number" ? row.complexity_max : null,
    excluded_genres: row.excluded_genres,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

function debugError(source: string, error: unknown) {
  if (!import.meta.env.DEV) return;
  const safeError = error instanceof Error ? { name: error.name, message: error.message } : error;
  console.error(`[Интеллекта][preferences] ${source}`, safeError);
}

function createServiceError(message: string, cause?: unknown) {
  debugError(message, cause);
  return new Error(message);
}

async function getCurrentUserId(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw createServiceError("Не удалось проверить текущего пользователя", error);
  }

  const userId = data.user?.id;
  if (!userId) {
    throw createServiceError("Войдите, чтобы сохранить профиль чтения");
  }

  return userId;
}

export function normalizePreferences(row: UserPreferencesRow | null): UserPreferences | null {
  if (!row) return null;

  const min = normalizeComplexity(row.complexity_min, DEFAULT_COMPLEXITY_MIN);
  const max = normalizeComplexity(row.complexity_max, DEFAULT_COMPLEXITY_MAX);

  return {
    userId: row.user_id,
    genres: uniqueCleanStrings(row.genres),
    topics: uniqueCleanStrings(row.topics),
    goals: uniqueCleanStrings(row.goals),
    complexityMin: Math.min(min, max),
    complexityMax: Math.max(min, max),
    excludedGenres: uniqueCleanStrings(row.excluded_genres),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export function mapPreferencesToDb(input: UpdateUserPreferencesInput, userId: string): UserPreferencesDbInput {
  const normalized = normalizeInput(input);

  return {
    user_id: userId,
    genres: normalized.genres,
    topics: normalized.topics,
    goals: normalized.goals,
    complexity_min: normalized.complexityMin,
    complexity_max: normalized.complexityMax,
    excluded_genres: normalized.excludedGenres,
  };
}

export async function getUserPreferences(userId?: string): Promise<UserPreferences | null> {
  const supabase = getSupabaseClient();
  const currentUserId = await getCurrentUserId();
  const targetUserId = userId ?? currentUserId;

  if (targetUserId !== currentUserId) {
    throw createServiceError("Недостаточно прав для просмотра чужих предпочтений");
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .select("user_id, genres, topics, goals, complexity_min, complexity_max, excluded_genres, created_at, updated_at")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (error) {
    throw createServiceError("Не удалось загрузить предпочтения", error);
  }

  return normalizePreferences(toRow(data));
}

export async function upsertUserPreferences(input: UpdateUserPreferencesInput): Promise<UserPreferences> {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();
  const payload = mapPreferencesToDb(input, userId);

  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(payload, { onConflict: "user_id" })
    .select("user_id, genres, topics, goals, complexity_min, complexity_max, excluded_genres, created_at, updated_at")
    .single();

  if (error) {
    throw createServiceError("Не удалось сохранить предпочтения", error);
  }

  const normalized = normalizePreferences(toRow(data));
  if (!normalized) {
    throw createServiceError("Supabase вернул некорректный профиль предпочтений");
  }

  return normalized;
}

export async function resetUserPreferences(): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from("user_preferences")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw createServiceError("Не удалось очистить предпочтения", error);
  }
}

export async function hasUserPreferences(): Promise<boolean> {
  const preferences = await getUserPreferences();
  if (!preferences) return false;

  return (
    preferences.genres.length > 0 ||
    preferences.topics.length > 0 ||
    preferences.goals.length > 0 ||
    preferences.excludedGenres.length > 0 ||
    preferences.complexityMin !== DEFAULT_COMPLEXITY_MIN ||
    preferences.complexityMax !== DEFAULT_COMPLEXITY_MAX
  );
}
