import { getSupabaseClient } from "../lib/supabase";

export type BookFormatValue = "paper" | "ebook" | "audiobook";
export type BookAiProfileStatus = "pending" | "processing" | "ready" | "error";

export interface Author {
  id: string;
  full_name: string;
  bio: string | null;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
}

export interface BookAiProfile {
  book_id: string;
  summary: string | null;
  topics: string[];
  keywords: string[];
  complexity_level: number | null;
  emotional_tone: string | null;
  embedding?: unknown;
  status: BookAiProfileStatus;
  updated_at: string | null;
}

export interface BookAdminRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isbn: string | null;
  publisher: string | null;
  year: number | null;
  publication_year: number | null;
  price: number;
  format: BookFormatValue;
  cover_url: string | null;
  stock_qty: number;
  rating: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  authors: Author[];
  genres: Genre[];
  ai_profile: BookAiProfile | null;
}

export interface CreateBookInput {
  title: string;
  slug: string;
  description: string;
  isbn?: string | null;
  publisher?: string | null;
  year?: number | null;
  price: number;
  format: BookFormatValue;
  cover_url?: string | null;
  stock_qty: number;
  is_active: boolean;
  author_ids: string[];
  genre_ids: string[];
}

export type UpdateBookInput = CreateBookInput;

type RpcAuthor = { id?: string; full_name?: string; bio?: string | null };
type RpcGenre = { id?: string; name?: string; slug?: string; parent_id?: string | null };

type AdminBookRpcRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isbn: string | null;
  publisher: string | null;
  publication_year: number | null;
  price: number | string | null;
  format: string | null;
  cover_url: string | null;
  stock_qty: number | null;
  rating: number | string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  authors: RpcAuthor[] | null;
  genres: RpcGenre[] | null;
  ai_summary: string | null;
  ai_topics: string[] | null;
  ai_keywords: string[] | null;
  complexity_level: number | null;
  emotional_tone: string | null;
  ai_status: string | null;
  ai_updated_at: string | null;
};

function toNumber(value: number | string | null | undefined, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toBookFormat(value: string | null | undefined): BookFormatValue {
  if (value === "ebook" || value === "audiobook" || value === "paper") return value;
  return "paper";
}

function toAiStatus(value: string | null | undefined): BookAiProfileStatus {
  if (value === "processing" || value === "ready" || value === "error" || value === "pending") return value;
  return "pending";
}

function normalizeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function mapRpcRow(row: AdminBookRpcRow): BookAdminRow {
  const authors: Author[] = normalizeArray(row.authors)
    .filter((item): item is Required<Pick<Author, "id" | "full_name">> & { bio?: string | null } => Boolean(item.id && item.full_name))
    .map((item) => ({ id: item.id, full_name: item.full_name, bio: item.bio ?? null }));

  const genres: Genre[] = normalizeArray(row.genres)
    .filter((item): item is Required<Pick<Genre, "id" | "name">> & { slug?: string; parent_id?: string | null } => Boolean(item.id && item.name))
    .map((item) => ({ id: item.id, name: item.name, slug: item.slug ?? "", parent_id: item.parent_id ?? null }));

  const aiStatus = toAiStatus(row.ai_status);
  const aiProfile: BookAiProfile | null = row.ai_status
    ? {
        book_id: row.id,
        summary: row.ai_summary,
        topics: normalizeArray(row.ai_topics),
        keywords: normalizeArray(row.ai_keywords),
        complexity_level: row.complexity_level,
        emotional_tone: row.emotional_tone,
        status: aiStatus,
        updated_at: row.ai_updated_at,
      }
    : null;

  const publicationYear = row.publication_year ?? null;

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    isbn: row.isbn,
    publisher: row.publisher,
    year: publicationYear,
    publication_year: publicationYear,
    price: toNumber(row.price),
    format: toBookFormat(row.format),
    cover_url: row.cover_url,
    stock_qty: row.stock_qty ?? 0,
    rating: toNumber(row.rating),
    is_active: row.is_active ?? false,
    created_at: row.created_at,
    updated_at: row.updated_at,
    authors,
    genres,
    ai_profile: aiProfile,
  };
}

function serializeBookInput(input: CreateBookInput | UpdateBookInput): Record<string, string | number | boolean | null> {
  return {
    title: input.title.trim(),
    slug: input.slug.trim(),
    description: input.description.trim(),
    isbn: input.isbn?.trim() || null,
    publisher: input.publisher?.trim() || null,
    publication_year: input.year ?? null,
    price: input.price,
    format: input.format,
    cover_url: input.cover_url?.trim() || null,
    stock_qty: input.stock_qty,
    is_active: input.is_active,
  };
}

function toPlainIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

export function getAdminCatalogErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("admin privileges") || lower.includes("permission") || lower.includes("row-level security") || lower.includes("42501")) {
    return "Недостаточно прав для изменения книги.";
  }

  if (lower.includes("books_slug_key") || lower.includes("duplicate key") || lower.includes("unique")) {
    return "Книга с таким slug уже существует.";
  }

  if (lower.includes("invalid author")) return "Выбран недоступный автор.";
  if (lower.includes("invalid genre")) return "Выбран недоступный жанр.";
  if (lower.includes("book not found") || lower.includes("p0002")) return "Книга не найдена.";

  if (lower.includes("network") || lower.includes("fetch")) {
    return "Не удалось подключиться к Supabase. Проверьте сеть и переменные окружения.";
  }

  return "Не удалось сохранить изменения каталога.";
}

export async function getAdminBooks(): Promise<BookAdminRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_get_books");

  if (error) throw new Error(getAdminCatalogErrorMessage(error));

  return ((data ?? []) as AdminBookRpcRow[]).map(mapRpcRow);
}

export async function getBookForEdit(bookId: string): Promise<BookAdminRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_get_book", { p_book_id: bookId });

  if (error) throw new Error(getAdminCatalogErrorMessage(error));

  const rows = (data ?? []) as AdminBookRpcRow[];
  return rows[0] ? mapRpcRow(rows[0]) : null;
}

export async function createBook(input: CreateBookInput): Promise<BookAdminRow> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_create_book", {
    p_book: serializeBookInput(input),
    p_author_ids: toPlainIds(input.author_ids),
    p_genre_ids: toPlainIds(input.genre_ids),
  });

  if (error) throw new Error(getAdminCatalogErrorMessage(error));

  const bookId = typeof data === "string" ? data : String(data);
  const created = await getBookForEdit(bookId);
  if (!created) throw new Error("Книга создана, но не удалось получить ее из Supabase.");
  return created;
}

export async function updateBook(bookId: string, input: UpdateBookInput): Promise<BookAdminRow> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_update_book", {
    p_book_id: bookId,
    p_book: serializeBookInput(input),
    p_author_ids: toPlainIds(input.author_ids),
    p_genre_ids: toPlainIds(input.genre_ids),
  });

  if (error) throw new Error(getAdminCatalogErrorMessage(error));

  const updated = await getBookForEdit(bookId);
  if (!updated) throw new Error("Книга обновлена, но не удалось получить ее из Supabase.");
  return updated;
}

export async function softDeleteBook(bookId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_soft_delete_book", { p_book_id: bookId });
  if (error) throw new Error(getAdminCatalogErrorMessage(error));
}

export async function restoreBook(bookId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_restore_book", { p_book_id: bookId });
  if (error) throw new Error(getAdminCatalogErrorMessage(error));
}

export async function updateBookAuthors(bookId: string, authorIds: string[]): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_set_book_authors", {
    p_book_id: bookId,
    p_author_ids: toPlainIds(authorIds),
  });
  if (error) throw new Error(getAdminCatalogErrorMessage(error));
}

export async function updateBookGenres(bookId: string, genreIds: string[]): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_set_book_genres", {
    p_book_id: bookId,
    p_genre_ids: toPlainIds(genreIds),
  });
  if (error) throw new Error(getAdminCatalogErrorMessage(error));
}

export async function getAuthors(): Promise<Author[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("authors")
    .select("id, full_name, bio")
    .order("full_name", { ascending: true });

  if (error) throw new Error(getAdminCatalogErrorMessage(error));
  return (data ?? []) as Author[];
}

export async function createAuthor(input: { full_name: string; bio?: string | null }): Promise<Author> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("authors")
    .insert({ full_name: input.full_name.trim(), bio: input.bio?.trim() || null })
    .select("id, full_name, bio")
    .single();

  if (error) throw new Error(getAdminCatalogErrorMessage(error));
  return data as Author;
}

export async function getGenres(): Promise<Genre[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("genres")
    .select("id, name, slug, parent_id")
    .order("name", { ascending: true });

  if (error) throw new Error(getAdminCatalogErrorMessage(error));
  return (data ?? []) as Genre[];
}

export async function createGenre(input: { name: string; parent_id?: string | null }): Promise<Genre> {
  const supabase = getSupabaseClient();
  const slug = input.name
    .trim()
    .toLowerCase()
    .replace(/ё/g, "e")
    .replace(/[^a-z0-9а-я]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  const { data, error } = await supabase
    .from("genres")
    .insert({ name: input.name.trim(), slug, parent_id: input.parent_id ?? null })
    .select("id, name, slug, parent_id")
    .single();

  if (error) throw new Error(getAdminCatalogErrorMessage(error));
  return data as Genre;
}

export async function updateBookAiProfileStatus(bookId: string, status: BookAiProfileStatus): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("book_ai_profiles")
    .upsert(
      {
        book_id: bookId,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "book_id" },
    );

  if (error) throw new Error(getAdminCatalogErrorMessage(error));
}

export async function markBookAiProfileStale(bookId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("admin_mark_book_ai_profile_pending", { p_book_id: bookId });
  if (error) throw new Error(getAdminCatalogErrorMessage(error));
}
