import { getSupabaseClient } from "../lib/supabase";
import {
  mapCatalogRowToBook,
  type CatalogViewRow,
} from "./catalogService";
import type {
  Book,
  RecommendationItem,
  UserEventRow,
  UserEventType,
  UserPreferences,
} from "../app/components/types";

export type RecommendationState = {
  items: RecommendationItem[];
  loading: boolean;
  error: string | null;
};

type FavoriteRow = { book_id: string };
type CartRow = { book_id: string };
type OrderRow = { id: string };
type OrderItemRow = { book_id: string | null };
type UserEventDbRow = {
  id: string;
  user_id?: string | null;
  book_id?: string | null;
  event_type: UserEventType | string;
  event_payload?: Record<string, unknown> | null;
  created_at?: string | null;
};
type BookAiProfileRow = {
  book_id: string;
  summary?: string | null;
  topics?: unknown;
  keywords?: unknown;
  complexity_level?: number | null;
  emotional_tone?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

type RecommendationSignals = {
  userId: string | null;
  preferences: UserPreferences | null;
  favoriteIds: Set<string>;
  cartIds: Set<string>;
  purchasedIds: Set<string>;
  events: UserEventRow[];
};

type ScoredBook = RecommendationItem & {
  rawScore: number;
};

const DEFAULT_LIMIT = 5;
const MAX_EVENT_ROWS = 120;
const MIN_VISIBLE_SCORE = 0.05;

const STOP_WORDS = new Set([
  "и", "в", "во", "на", "о", "об", "обо", "для", "по", "с", "со", "к", "ко", "от", "до", "из", "за", "над", "под", "при", "без",
  "как", "что", "это", "эта", "этот", "книга", "книги", "роман", "история", "чтение", "the", "a", "an", "and", "or", "of", "to", "for",
]);

function debugError(source: string, error: unknown) {
  if (!import.meta.env.DEV) return;
  const value = error as { code?: string; message?: string; details?: string | null; hint?: string | null } | null;
  console.error(`[Интеллекта][recommendations] ${source}`, {
    code: value?.code,
    message: value?.message ?? (error instanceof Error ? error.message : String(error ?? "")),
    details: value?.details,
    hint: value?.hint,
  });
}

function createServiceError(message: string, cause?: unknown) {
  debugError(message, cause);
  return new Error(message);
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'.,!?;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const clean = value.trim();
    const key = normalizeText(clean);
    if (!clean || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }

  return result;
}

function normalizeSet(values: string[] | undefined | null): Set<string> {
  return new Set((values ?? []).map(normalizeText).filter(Boolean));
}

function compactReasons(reasons: string[], max = 4): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const reason of reasons) {
    const clean = reason.trim();
    const key = normalizeText(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= max) break;
  }

  return result;
}

function toComplexityNumber(book: Book): number {
  switch (book.ai.complexityLevel) {
    case "Лёгкий": return 1;
    case "Средний": return 2;
    case "Сложный": return 3;
    case "Профессиональный": return 5;
    default: return 3;
  }
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function getBookTextBlob(book: Book): string {
  return normalizeText([
    book.title,
    book.authors.join(" "),
    book.genres.join(" "),
    book.description,
    book.topics.join(" "),
    book.ai.summary,
    book.ai.topics.join(" "),
    book.ai.keywords.join(" "),
    book.ai.emotionalTone,
  ].join(" "));
}

function getBookSignalSet(book: Book): Set<string> {
  return normalizeSet([
    ...book.genres,
    ...book.topics,
    ...book.ai.topics,
    ...book.ai.keywords,
    ...tokenize(book.ai.summary).slice(0, 12),
  ]);
}

function intersection<T>(left: Set<T>, right: Set<T>): T[] {
  const result: T[] = [];
  left.forEach((value) => {
    if (right.has(value)) result.push(value);
  });
  return result;
}

function overlaps(left: Set<string>, right: Set<string>): boolean {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function getEventBookId(event: UserEventRow): string | null {
  if (event.book_id) return event.book_id;
  const payloadBookId = event.event_payload?.book_id;
  return typeof payloadBookId === "string" ? payloadBookId : null;
}

async function getCurrentUserId(): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    debugError("session:error", error);
    return null;
  }
  return data.session?.user.id ?? null;
}

async function fetchCatalogBooks(): Promise<Book[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("book_catalog_view")
    .select("*")
    .order("rating", { ascending: false });

  if (error) throw createServiceError("Не удалось загрузить каталог для рекомендаций", error);

  const books = ((data ?? []) as CatalogViewRow[])
    .map(mapCatalogRowToBook)
    .filter((book) => book.isActive);

  const profiles = await fetchAiProfiles();
  if (profiles.size === 0) return books;

  return books.map((book) => {
    const profile = profiles.get(book.id);
    if (!profile) return book;

    const topics = normalizeList(profile.topics);
    const keywords = normalizeList(profile.keywords);

    return {
      ...book,
      topics: Array.from(new Set([...book.topics, ...topics, ...keywords])),
      ai: {
        ...book.ai,
        summary: profile.summary || book.ai.summary,
        topics: topics.length ? topics : book.ai.topics,
        keywords: keywords.length ? keywords : book.ai.keywords,
        complexityLevel: typeof profile.complexity_level === "number"
          ? mapComplexity(profile.complexity_level)
          : book.ai.complexityLevel,
        emotionalTone: profile.emotional_tone || book.ai.emotionalTone,
        status: profile.status === "ready" ? "Готово" : book.ai.status,
        updatedAt: profile.updated_at?.slice(0, 10) || book.ai.updatedAt,
      },
    };
  });
}

async function fetchAiProfiles(): Promise<Map<string, BookAiProfileRow>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("book_ai_profiles")
    .select("book_id, summary, topics, keywords, complexity_level, emotional_tone, status, updated_at");

  if (error) {
    // book_catalog_view already contains AI fields. Direct profile read is best-effort
    // because RLS may expose only ready profiles of active books.
    debugError("book_ai_profiles:read:error", error);
    return new Map();
  }

  const result = new Map<string, BookAiProfileRow>();
  ((data ?? []) as BookAiProfileRow[]).forEach((row) => {
    if (typeof row.book_id === "string") result.set(row.book_id, row);
  });
  return result;
}

function mapComplexity(value: number): Book["ai"]["complexityLevel"] {
  if (value <= 1) return "Лёгкий";
  if (value === 2) return "Средний";
  if (value === 3) return "Сложный";
  return "Профессиональный";
}

async function fetchPreferences(userId: string): Promise<UserPreferences | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .select("user_id, genres, topics, goals, complexity_min, complexity_max, excluded_genres, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw createServiceError("Не удалось загрузить профиль предпочтений", error);
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    userId,
    genres: normalizeList(row.genres),
    topics: normalizeList(row.topics),
    goals: normalizeList(row.goals),
    complexityMin: typeof row.complexity_min === "number" ? row.complexity_min : Number(row.complexity_min ?? 1),
    complexityMax: typeof row.complexity_max === "number" ? row.complexity_max : Number(row.complexity_max ?? 5),
    excludedGenres: normalizeList(row.excluded_genres),
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

async function fetchFavoriteIds(userId: string): Promise<Set<string>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("book_id")
    .eq("user_id", userId);

  if (error) throw createServiceError("Не удалось загрузить избранное для рекомендаций", error);
  return new Set(((data ?? []) as FavoriteRow[]).map((row) => row.book_id).filter(Boolean));
}

async function fetchCartIds(userId: string): Promise<Set<string>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select("book_id")
    .eq("user_id", userId);

  if (error) throw createServiceError("Не удалось загрузить корзину для рекомендаций", error);
  return new Set(((data ?? []) as CartRow[]).map((row) => row.book_id).filter(Boolean));
}

async function fetchPurchasedIds(userId: string): Promise<Set<string>> {
  const supabase = getSupabaseClient();
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (ordersError) throw createServiceError("Не удалось загрузить историю заказов для рекомендаций", ordersError);

  const orderIds = ((orders ?? []) as OrderRow[]).map((row) => row.id).filter(Boolean);
  if (!orderIds.length) return new Set();

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("book_id")
    .in("order_id", orderIds);

  if (itemsError) throw createServiceError("Не удалось загрузить состав заказов для рекомендаций", itemsError);

  return new Set(((items ?? []) as OrderItemRow[])
    .map((row) => row.book_id)
    .filter((id): id is string => Boolean(id)));
}

async function fetchUserEvents(userId: string): Promise<UserEventRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("user_events")
    .select("id, user_id, book_id, event_type, event_payload, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_EVENT_ROWS);

  if (error) throw createServiceError("Не удалось загрузить события пользователя для рекомендаций", error);

  return ((data ?? []) as UserEventDbRow[])
    .filter((row) => typeof row.id === "string" && typeof row.event_type === "string")
    .map((row) => ({
      id: row.id,
      user_id: row.user_id ?? null,
      book_id: row.book_id ?? undefined,
      event_type: row.event_type as UserEventType,
      event_payload: row.event_payload ?? {},
      created_at: row.created_at ?? undefined,
    }));
}

async function fetchSignals(): Promise<RecommendationSignals> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      userId: null,
      preferences: null,
      favoriteIds: new Set(),
      cartIds: new Set(),
      purchasedIds: new Set(),
      events: [],
    };
  }

  const [preferences, favoriteIds, cartIds, purchasedIds, events] = await Promise.all([
    fetchPreferences(userId),
    fetchFavoriteIds(userId),
    fetchCartIds(userId),
    fetchPurchasedIds(userId),
    fetchUserEvents(userId),
  ]);

  return { userId, preferences, favoriteIds, cartIds, purchasedIds, events };
}

function isExcludedByGenre(book: Book, preferences: UserPreferences | null): boolean {
  const excluded = normalizeSet(preferences?.excludedGenres);
  if (excluded.size === 0) return false;
  return book.genres.some((genre) => excluded.has(normalizeText(genre)));
}

function makeBookIndex(books: Book[]): Map<string, Book> {
  const index = new Map<string, Book>();
  books.forEach((book) => index.set(book.id, book));
  return index;
}

function scoreByPreferences(book: Book, preferences: UserPreferences | null): { score: number; reasons: string[] } {
  if (!preferences) return { score: 0, reasons: [] };

  let score = 0;
  const reasons: string[] = [];
  const topicPrefs = normalizeSet(preferences.topics);
  const genrePrefs = normalizeSet(preferences.genres);
  const bookTopics = normalizeSet([...book.topics, ...book.ai.topics, ...book.ai.keywords]);
  const bookGenres = normalizeSet(book.genres);

  const matchedTopics = intersection(topicPrefs, bookTopics).slice(0, 2);
  if (matchedTopics.length) {
    score += Math.min(0.36, matchedTopics.length * 0.18);
    matchedTopics.forEach((topic) => reasons.push(`совпадает тема: ${topic}`));
  }

  const matchedGenres = intersection(genrePrefs, bookGenres).slice(0, 2);
  if (matchedGenres.length) {
    score += Math.min(0.32, matchedGenres.length * 0.16);
    matchedGenres.forEach((genre) => reasons.push(`совпадает жанр: ${genre}`));
  }

  const complexity = toComplexityNumber(book);
  const min = Number.isFinite(preferences.complexityMin) ? preferences.complexityMin : 1;
  const max = Number.isFinite(preferences.complexityMax) ? preferences.complexityMax : 5;
  if (complexity >= min && complexity <= max) {
    score += 0.15;
    reasons.push("подходит уровень сложности");
  }

  const blob = getBookTextBlob(book);
  const matchedGoal = preferences.goals.find((goal) => {
    const goalTokens = tokenize(goal);
    if (goalTokens.length === 0) return false;
    return goalTokens.some((token) => blob.includes(token));
  });

  if (matchedGoal) {
    score += 0.14;
    reasons.push(`соответствует цели чтения: ${matchedGoal}`);
  }

  return { score, reasons };
}

function scoreBySimilarBooks(
  book: Book,
  sourceIds: Set<string>,
  booksById: Map<string, Book>,
  weight: number,
  reason: string,
): { score: number; reasons: string[] } {
  if (sourceIds.size === 0) return { score: 0, reasons: [] };

  const targetSignals = getBookSignalSet(book);
  if (targetSignals.size === 0) return { score: 0, reasons: [] };

  let bestOverlap = 0;
  sourceIds.forEach((sourceId) => {
    if (sourceId === book.id) return;
    const sourceBook = booksById.get(sourceId);
    if (!sourceBook) return;
    const sourceSignals = getBookSignalSet(sourceBook);
    const overlap = intersection(targetSignals, sourceSignals).length;
    bestOverlap = Math.max(bestOverlap, overlap);
  });

  if (bestOverlap <= 0) return { score: 0, reasons: [] };
  return {
    score: Math.min(weight, 0.04 * bestOverlap + 0.06),
    reasons: [reason],
  };
}

function scoreByEvents(
  book: Book,
  events: UserEventRow[],
  booksById: Map<string, Book>,
): { score: number; reasons: string[] } {
  const viewedIds = new Set<string>();
  const clickedRecommendationIds = new Set<string>();
  const searchedTerms: string[] = [];

  events.slice(0, 60).forEach((event) => {
    const eventBookId = getEventBookId(event);
    if (event.event_type === "book_view" && eventBookId) viewedIds.add(eventBookId);
    if (event.event_type === "recommendation_click" && eventBookId) clickedRecommendationIds.add(eventBookId);
    if (event.event_type === "search") {
      const query = event.event_payload?.query;
      if (typeof query === "string") searchedTerms.push(...tokenize(query).slice(0, 6));
    }
  });

  const relatedViewed = scoreBySimilarBooks(
    book,
    new Set([...viewedIds, ...clickedRecommendationIds]),
    booksById,
    0.12,
    "основано на недавно просмотренных книгах",
  );

  let searchScore = 0;
  const searchReasons: string[] = [];
  if (searchedTerms.length) {
    const blob = getBookTextBlob(book);
    const matched = Array.from(new Set(searchedTerms)).filter((term) => blob.includes(term)).slice(0, 2);
    if (matched.length) {
      searchScore = Math.min(0.1, matched.length * 0.05);
      searchReasons.push("учитывает ваши недавние поисковые запросы");
    }
  }

  return {
    score: relatedViewed.score + searchScore,
    reasons: [...relatedViewed.reasons, ...searchReasons],
  };
}

function scoreBook(book: Book, signals: RecommendationSignals, booksById: Map<string, Book>): ScoredBook | null {
  if (!book.isActive) return null;
  if (signals.cartIds.has(book.id)) return null;
  if (signals.purchasedIds.has(book.id)) return null;
  if (isExcludedByGenre(book, signals.preferences)) return null;

  let rawScore = 0;
  const reasons: string[] = [];

  const preferenceScore = scoreByPreferences(book, signals.preferences);
  rawScore += preferenceScore.score;
  reasons.push(...preferenceScore.reasons);

  const favoriteScore = scoreBySimilarBooks(
    book,
    signals.favoriteIds,
    booksById,
    0.18,
    "похожа на книги из избранного",
  );
  rawScore += favoriteScore.score;
  reasons.push(...favoriteScore.reasons);

  const purchaseScore = scoreBySimilarBooks(
    book,
    signals.purchasedIds,
    booksById,
    0.16,
    "похожа на ранее купленные книги",
  );
  rawScore += purchaseScore.score;
  reasons.push(...purchaseScore.reasons);

  const eventScore = scoreByEvents(book, signals.events, booksById);
  rawScore += eventScore.score;
  reasons.push(...eventScore.reasons);

  if (book.rating > 0) {
    rawScore += Math.min(0.08, Math.max(0, book.rating - 3.5) * 0.04);
    if (book.rating >= 4.4) reasons.push(`высокая оценка читателей · ${book.rating.toFixed(1)}`);
  }

  const normalizedScore = Math.max(0, Math.min(0.99, rawScore));
  const fallbackReasons = [
    "активная книга из каталога",
    book.rating >= 4 ? `высокая оценка читателей · ${book.rating.toFixed(1)}` : "подходит для знакомства с каталогом",
  ];

  return {
    book,
    rawScore,
    score: normalizedScore,
    reasons: compactReasons(reasons.length ? reasons : fallbackReasons),
  };
}

function makePopularRecommendations(books: Book[], limit: number, signals: RecommendationSignals): RecommendationItem[] {
  return books
    .filter((book) => book.isActive)
    .filter((book) => !signals.cartIds.has(book.id))
    .filter((book) => !signals.purchasedIds.has(book.id))
    .filter((book) => !isExcludedByGenre(book, signals.preferences))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit)
    .map((book) => ({
      book,
      score: Math.min(0.72, 0.45 + Math.max(0, book.rating - 3.5) * 0.08),
      reasons: compactReasons([
        signals.userId ? "популярная книга, пока данных для персонализации мало" : "популярная книга каталога",
        book.rating >= 4 ? `высокая оценка читателей · ${book.rating.toFixed(1)}` : "подходит для знакомства с темой",
        book.ai.topics[0] ? `тема: ${book.ai.topics[0]}` : book.genres[0] ? `жанр: ${book.genres[0]}` : "активная книга из каталога",
      ]),
    }));
}

function rankRecommendations(books: Book[], signals: RecommendationSignals, limit: number): RecommendationItem[] {
  const booksById = makeBookIndex(books);
  const scored = books
    .map((book) => scoreBook(book, signals, booksById))
    .filter((item): item is ScoredBook => Boolean(item))
    .sort((a, b) => b.rawScore - a.rawScore || b.book.rating - a.book.rating);

  const primary = scored
    .filter((item) => item.rawScore >= MIN_VISIBLE_SCORE)
    .slice(0, Math.max(limit, DEFAULT_LIMIT));

  const usedIds = new Set(primary.map((item) => item.book.id));
  const popularFill = makePopularRecommendations(books, Math.max(limit, DEFAULT_LIMIT), signals)
    .filter((item) => !usedIds.has(item.book.id));

  return [...primary, ...popularFill]
    .slice(0, Math.max(limit, DEFAULT_LIMIT))
    .map((item) => ({
      book: item.book,
      score: Math.max(0.01, Math.min(0.99, item.score)),
      reasons: compactReasons(item.reasons),
    }));
}

export async function getRecommendations(limit: number = DEFAULT_LIMIT): Promise<RecommendationItem[]> {
  const safeLimit = Math.max(1, Math.min(24, Math.trunc(limit) || DEFAULT_LIMIT));
  const [books, signals] = await Promise.all([
    fetchCatalogBooks(),
    fetchSignals(),
  ]);

  if (!books.length) return [];
  return rankRecommendations(books, signals, safeLimit);
}

export async function getRecommendationDetails(bookId: string): Promise<RecommendationItem | null> {
  if (!bookId) return null;
  const items = await getRecommendations(24);
  return items.find((item) => item.book.id === bookId || item.book.slug === bookId) ?? null;
}
