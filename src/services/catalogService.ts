import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";
import { BOOKS } from "../app/components/data";
import type { Book, Complexity, Format } from "../app/components/types";

export type CatalogSort = "popular" | "rating" | "price_asc" | "price_desc" | "newest";

export type CatalogQuery = {
  q?: string;
  genres?: string[];
  topics?: string[];
  formats?: string[];
  complexities?: Complexity[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: CatalogSort;
  limit?: number;
};

type CatalogAuthorRow = { id?: string; full_name?: string };
type CatalogGenreRow = { id?: string; name?: string; slug?: string };

export type CatalogViewRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isbn?: string | null;
  publisher?: string | null;
  publication_year?: number | null;
  price: number | string | null;
  format: "paper" | "ebook" | "audiobook" | string | null;
  cover_url: string | null;
  stock_qty: number | null;
  rating: number | string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  authors: CatalogAuthorRow[] | null;
  genres: CatalogGenreRow[] | null;
  ai_summary: string | null;
  ai_topics: string[] | null;
  ai_keywords: string[] | null;
  complexity_level: number | null;
  emotional_tone: string | null;
  ai_status: "pending" | "processing" | "ready" | "error" | string | null;
  ai_updated_at: string | null;
};

const cachedBooks = new Map<string, Book>();
const cachedBooksBySlug = new Map<string, Book>();

function toNumber(value: number | string | null | undefined, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toFormat(value: string | null | undefined): Format {
  if (value === "ebook") return "Электронная";
  if (value === "audiobook") return "Аудио";
  return "Печатная";
}

function toComplexity(value: number | null | undefined): Complexity {
  if (value === 1) return "Лёгкий";
  if (value === 3) return "Сложный";
  if (value === 4 || value === 5) return "Профессиональный";
  return "Средний";
}

function toAiStatus(value: string | null | undefined): Book["ai"]["status"] {
  if (value === "processing") return "Выполняется";
  if (value === "ready") return "Готово";
  if (value === "error") return "Ошибка";
  return "В очереди";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/ё/g, "е");
}

export function mapCatalogRowToBook(row: CatalogViewRow): Book {
  const authors = Array.isArray(row.authors)
    ? row.authors.map((a) => a.full_name).filter((v): v is string => Boolean(v))
    : [];
  const genres = Array.isArray(row.genres)
    ? row.genres.map((g) => g.name).filter((v): v is string => Boolean(v))
    : [];
  const aiTopics = Array.isArray(row.ai_topics) ? row.ai_topics.filter(Boolean) : [];
  const aiKeywords = Array.isArray(row.ai_keywords) ? row.ai_keywords.filter(Boolean) : [];
  const topics = Array.from(new Set([...aiTopics, ...aiKeywords].filter(Boolean)));

  const book: Book = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    authors: authors.length ? authors : ["Автор не указан"],
    genres,
    description: row.description ?? "Описание книги пока не добавлено.",
    price: toNumber(row.price),
    format: toFormat(row.format),
    coverUrl: row.cover_url ?? "",
    rating: toNumber(row.rating, 0),
    reviewsCount: 0,
    isActive: row.is_active ?? true,
    inStock: row.stock_qty ?? 0,
    topics,
    ai: {
      summary: row.ai_summary ?? "Интеллектуальный анализ пока не готов.",
      topics: aiTopics,
      keywords: aiKeywords,
      complexityLevel: toComplexity(row.complexity_level),
      emotionalTone: row.emotional_tone ?? "—",
      status: toAiStatus(row.ai_status),
      updatedAt: formatDate(row.ai_updated_at ?? row.updated_at),
    },
  };

  cachedBooks.set(book.id, book);
  cachedBooksBySlug.set(book.slug, book);
  return book;
}

function getSearchBlob(book: Book) {
  return normalizeText([
    book.title,
    book.description,
    book.authors.join(" "),
    book.genres.join(" "),
    book.topics.join(" "),
    book.ai.summary,
    book.ai.keywords.join(" "),
  ].join(" "));
}

function filterBooks(books: Book[], params: CatalogQuery = {}) {
  let list = [...books].filter((b) => b.isActive);

  if (params.q?.trim()) {
    const q = normalizeText(params.q.trim());
    list = list.filter((b) => getSearchBlob(b).includes(q));
  }

  if (params.genres?.length) {
    const genres = params.genres.map(normalizeText);
    list = list.filter((b) => b.genres.some((g) => genres.includes(normalizeText(g))));
  }

  if (params.topics?.length) {
    const topics = params.topics.map(normalizeText);
    list = list.filter((b) => b.topics.some((t) => topics.includes(normalizeText(t))));
  }

  if (params.formats?.length) {
    list = list.filter((b) => params.formats?.includes(b.format));
  }

  if (params.complexities?.length) {
    list = list.filter((b) => params.complexities?.includes(b.ai.complexityLevel));
  }

  if (typeof params.minPrice === "number") list = list.filter((b) => b.price >= params.minPrice!);
  if (typeof params.maxPrice === "number") list = list.filter((b) => b.price <= params.maxPrice!);
  if (params.inStock) list = list.filter((b) => b.inStock > 0);

  switch (params.sort) {
    case "rating":
    case "popular":
      list.sort((a, b) => b.rating - a.rating);
      break;
    case "price_asc":
      list.sort((a, b) => a.price - b.price);
      break;
    case "price_desc":
      list.sort((a, b) => b.price - a.price);
      break;
    case "newest":
      list.sort((a, b) => b.id.localeCompare(a.id));
      break;
  }

  if (params.limit) list = list.slice(0, params.limit);
  return list;
}

async function fetchCatalogRows(): Promise<CatalogViewRow[]> {
  if (!isSupabaseConfigured()) {
    console.error("[Интеллекта][catalog] Supabase не настроен для каталога", {
      source: "book_catalog_view",
    });
    throw new Error("Supabase не настроен. Проверьте переменные окружения для каталога.");
  }

  const supabase = getSupabaseClient();
  if (import.meta.env.DEV) {
    console.info("[Интеллекта][catalog] Запрашиваем каталог из Supabase", {
      source: "book_catalog_view",
    });
  }

  const { data, error } = await supabase
    .from("book_catalog_view")
    .select("*")
    .order("rating", { ascending: false });

  if (error) {
    console.error("[Интеллекта][catalog] Ошибка запроса book_catalog_view", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  if (import.meta.env.DEV) {
    console.info("[Интеллекта][catalog] Получен ответ Supabase", {
      source: "book_catalog_view",
      count: data?.length ?? 0,
    });
  }

  return (data ?? []) as CatalogViewRow[];
}

export async function getCatalogBooks(params: CatalogQuery = {}): Promise<Book[]> {
  const rows = await fetchCatalogRows();
  const books = rows.map(mapCatalogRowToBook);
  return filterBooks(books, params);
}

export async function searchCatalogBooks(params: CatalogQuery = {}): Promise<Book[]> {
  return getCatalogBooks(params);
}

export async function getBookBySlug(slug: string): Promise<Book | null> {
  if (cachedBooksBySlug.has(slug)) return cachedBooksBySlug.get(slug)!;
  const rows = await fetchCatalogRows();
  const row = rows.find((r) => r.slug === slug || r.id === slug);
  return row ? mapCatalogRowToBook(row) : null;
}

export async function getBookById(id: string): Promise<Book | null> {
  if (cachedBooks.has(id)) return cachedBooks.get(id)!;
  const rows = await fetchCatalogRows();
  const row = rows.find((r) => r.id === id || r.slug === id);
  return row ? mapCatalogRowToBook(row) : null;
}

export async function getGenres(): Promise<string[]> {
  const books = await getCatalogBooks();
  return Array.from(new Set(books.flatMap((b) => b.genres))).sort((a, b) => a.localeCompare(b, "ru"));
}

export async function getAuthors(): Promise<string[]> {
  const books = await getCatalogBooks();
  return Array.from(new Set(books.flatMap((b) => b.authors))).sort((a, b) => a.localeCompare(b, "ru"));
}

export async function updateBookCover(bookId: string, coverUrl: string): Promise<void> {
  if (!bookId) {
    throw new Error("Не удалось определить книгу для обновления обложки.");
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("books")
    .update({ cover_url: coverUrl })
    .eq("id", bookId);

  if (error) {
    console.error("[Интеллекта][catalog] Ошибка обновления cover_url", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      bookId,
    });

    if (error.message?.toLowerCase().includes("row-level security") || error.code === "42501") {
      throw new Error("Недостаточно прав для обновления обложки.");
    }

    throw new Error("Не удалось сохранить ссылку на обложку.");
  }

  const cached = cachedBooks.get(bookId);
  if (cached) {
    const updated = { ...cached, coverUrl };
    cachedBooks.set(bookId, updated);
    cachedBooksBySlug.set(updated.slug, updated);
  }
}

export function clearCatalogCache(): void {
  cachedBooks.clear();
  cachedBooksBySlug.clear();
}

export function getCachedBookById(id: string): Book | undefined {
  return cachedBooks.get(id) ?? BOOKS.find((b) => b.id === id);
}

export function getCachedBooks(): Book[] {
  const books = Array.from(cachedBooks.values());
  return books.length ? books : BOOKS;
}

// Legacy mock data is intentionally kept only for local cart and recommendation mock compatibility.
// Favorites use Supabase from Stage 14 onward.
