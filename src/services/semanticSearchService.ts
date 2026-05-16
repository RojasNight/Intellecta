import type { Book, Complexity, Format } from "../app/components/types";

export type SemanticSearchReason = string;

export interface SemanticSearchFilters {
  genreId?: string | null;
  format?: "paper" | "ebook" | "audiobook" | Format | null;
  minPrice?: number | null;
  maxPrice?: number | null;
}

export interface SemanticSearchRequest {
  query: string;
  limit?: number;
  minSimilarity?: number;
  filters?: SemanticSearchFilters;
}

export interface SemanticSearchResult {
  bookId: string;
  book: Book;
  similarity: number;
  reasons: SemanticSearchReason[];
  matchedTopics: string[];
}

export interface SemanticSearchResponse {
  ok: boolean;
  query: string;
  mode: "semantic" | "text-fallback";
  fallback?: boolean;
  message?: string;
  items: SemanticSearchResult[];
}

type ApiAuthor = { id?: string; full_name?: string };
type ApiGenre = { id?: string; name?: string; slug?: string };
type ApiSemanticItem = {
  bookId: string;
  slug?: string;
  title: string;
  description?: string | null;
  price?: number | string | null;
  format?: string | null;
  coverUrl?: string | null;
  rating?: number | string | null;
  stockQty?: number | string | null;
  isActive?: boolean | null;
  authors?: ApiAuthor[];
  genres?: ApiGenre[];
  similarity?: number | string | null;
  aiSummary?: string | null;
  topics?: string[] | null;
  keywords?: string[] | null;
  complexityLevel?: number | null;
  emotionalTone?: string | null;
  reasons?: string[] | null;
};

function toNumber(value: number | string | null | undefined, fallback = 0): number {
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

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function mapItemToResult(item: ApiSemanticItem): SemanticSearchResult {
  const topics = normalizeList(item.topics);
  const keywords = normalizeList(item.keywords);
  const authors = Array.isArray(item.authors)
    ? item.authors.map((author) => author.full_name).filter((v): v is string => Boolean(v))
    : [];
  const genres = Array.isArray(item.genres)
    ? item.genres.map((genre) => genre.name).filter((v): v is string => Boolean(v))
    : [];

  const book: Book = {
    id: item.bookId,
    slug: item.slug || item.bookId,
    title: item.title,
    authors: authors.length ? authors : ["Автор не указан"],
    genres,
    description: item.description || "Описание книги пока не добавлено.",
    price: toNumber(item.price),
    format: toFormat(item.format),
    coverUrl: item.coverUrl || "",
    rating: toNumber(item.rating, 0),
    reviewsCount: 0,
    isActive: item.isActive !== false,
    inStock: toNumber(item.stockQty, 0),
    topics: Array.from(new Set([...topics, ...keywords])),
    ai: {
      summary: item.aiSummary || "Интеллектуальный анализ пока не готов.",
      topics,
      keywords,
      complexityLevel: toComplexity(item.complexityLevel),
      emotionalTone: item.emotionalTone || "—",
      status: "Готово",
      updatedAt: "—",
    },
  };

  const similarity = Math.max(0, Math.min(1, toNumber(item.similarity, 0)));

  return {
    bookId: item.bookId,
    book,
    similarity,
    reasons: normalizeList(item.reasons).slice(0, 3),
    matchedTopics: topics.filter((topic) => (item.reasons || []).some((reason) => reason.toLowerCase().includes(topic.toLowerCase()))).slice(0, 3),
  };
}

export async function semanticSearchBooks(request: SemanticSearchRequest): Promise<SemanticSearchResponse> {
  const query = request.query.trim();
  if (query.length < 3) {
    return { ok: true, query, mode: "text-fallback", fallback: true, items: [], message: "Введите запрос длиной не менее 3 символов." };
  }

  const response = await fetch("/api/semantic-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit: request.limit ?? 20,
      minSimilarity: request.minSimilarity,
      filters: request.filters ?? {},
    }),
  });

  const payload = await response.json().catch(() => null) as {
    ok?: boolean;
    query?: string;
    mode?: "semantic" | "text-fallback";
    fallback?: boolean;
    message?: string;
    error?: string;
    items?: ApiSemanticItem[];
  } | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "Смысловой поиск временно недоступен.");
  }

  return {
    ok: true,
    query: payload.query || query,
    mode: payload.mode || "semantic",
    fallback: Boolean(payload.fallback),
    message: payload.message,
    items: (payload.items || []).map(mapItemToResult),
  };
}
