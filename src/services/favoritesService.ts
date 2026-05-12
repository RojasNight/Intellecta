import { getSupabaseClient } from "../lib/supabase";
import { mapCatalogRowToBook, type CatalogViewRow } from "./catalogService";
import type { Book, FavoriteBook, FavoriteRow } from "../app/components/types";

export type AddFavoriteInput = { bookId: string };
export type RemoveFavoriteInput = { bookId: string };
export type ToggleFavoriteResult = "added" | "removed";

type FavoriteDbRow = {
  user_id: string;
  book_id: string;
  created_at?: string | null;
};

function debugError(source: string, error: unknown) {
  if (!import.meta.env.DEV) return;
  const safeError = error instanceof Error ? { name: error.name, message: error.message } : error;
  console.error(`[Интеллекта][favorites] ${source}`, safeError);
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
    throw createServiceError("Войдите, чтобы добавлять книги в избранное");
  }

  return userId;
}

function toFavoriteRow(row: unknown): FavoriteRow | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  if (typeof value.user_id !== "string" || typeof value.book_id !== "string") return null;

  return {
    user_id: value.user_id,
    book_id: value.book_id,
    created_at: typeof value.created_at === "string" ? value.created_at : undefined,
  };
}

export function normalizeFavoriteRow(row: unknown): FavoriteRow | null {
  return toFavoriteRow(row);
}

function isDuplicateFavoriteError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "23505" || message.includes("duplicate") || message.includes("favorites_pkey");
}

export async function getFavorites(): Promise<FavoriteRow[]> {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("favorites")
    .select("user_id, book_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw createServiceError("Не удалось загрузить избранное", error);
  }

  return (data ?? [])
    .map(normalizeFavoriteRow)
    .filter((row): row is FavoriteRow => row !== null);
}

export async function getFavoriteBookIds(): Promise<string[]> {
  const rows = await getFavorites();
  return rows.map((row) => row.book_id);
}

export async function getFavoriteBooks(bookIds?: string[]): Promise<FavoriteBook[]> {
  const favoriteIds = bookIds ?? (await getFavorites()).map((row) => row.book_id);

  if (!favoriteIds.length) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("book_catalog_view")
    .select("*")
    .in("id", favoriteIds);

  if (error) {
    throw createServiceError("Не удалось загрузить книги из избранного", error);
  }

  const booksById = new Map<string, Book>();
  ((data ?? []) as CatalogViewRow[])
    .map(mapCatalogRowToBook)
    .filter((book) => book.isActive)
    .forEach((book) => booksById.set(book.id, book));

  return favoriteIds
    .map((id) => booksById.get(id))
    .filter((book): book is FavoriteBook => Boolean(book));
}

export async function addFavorite(bookId: string): Promise<FavoriteRow> {
  if (!bookId) {
    throw createServiceError("Не удалось определить книгу для избранного");
  }

  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();
  const payload: FavoriteDbRow = { user_id: userId, book_id: bookId };

  const { data, error } = await supabase
    .from("favorites")
    .insert(payload)
    .select("user_id, book_id, created_at")
    .single();

  if (error) {
    if (isDuplicateFavoriteError(error)) {
      return { user_id: userId, book_id: bookId };
    }

    throw createServiceError("Не удалось добавить книгу в избранное", error);
  }

  const normalized = normalizeFavoriteRow(data);
  if (!normalized) {
    throw createServiceError("Supabase вернул некорректную запись избранного");
  }

  return normalized;
}

export async function removeFavorite(bookId: string): Promise<void> {
  if (!bookId) {
    throw createServiceError("Не удалось определить книгу для удаления из избранного");
  }

  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("book_id", bookId);

  if (error) {
    throw createServiceError("Не удалось удалить книгу из избранного", error);
  }
}

export async function isFavorite(bookId: string): Promise<boolean> {
  if (!bookId) return false;

  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("favorites")
    .select("book_id")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .maybeSingle();

  if (error) {
    throw createServiceError("Не удалось проверить избранное", error);
  }

  return Boolean(data);
}

export async function toggleFavorite(bookId: string): Promise<ToggleFavoriteResult> {
  const exists = await isFavorite(bookId);
  if (exists) {
    await removeFavorite(bookId);
    return "removed";
  }

  await addFavorite(bookId);
  return "added";
}

export async function clearFavorites(): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw createServiceError("Не удалось очистить избранное", error);
  }
}
