import { createClient } from "@supabase/supabase-js";
import { createTextEmbedding, getEmbeddingConfig, normalizeText, readEnv, toVectorLiteral } from "./_semantic";

const MAX_QUERY_LENGTH = 400;
const MAX_LIMIT = 40;
const DEFAULT_MIN_SIMILARITY = 0.35;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function serverConfig() {
  return {
    supabaseUrl: readEnv(["SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]),
    supabaseKey: readEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]),
  };
}

function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(parsed)));
}

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFormat(value) {
  if (value === "paper" || value === "ebook" || value === "audiobook") return value;
  if (value === "Печатная") return "paper";
  if (value === "Электронная") return "ebook";
  if (value === "Аудио") return "audiobook";
  return null;
}

function normalizeFilters(filters) {
  if (!filters || typeof filters !== "object") return {};
  return {
    genreId: typeof filters.genreId === "string" && filters.genreId.trim() ? filters.genreId.trim() : null,
    format: normalizeFormat(filters.format),
    minPrice: parseNumber(filters.minPrice),
    maxPrice: parseNumber(filters.maxPrice),
  };
}

function normalizeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function textFallbackScore(row, query) {
  const tokens = normalizeText(query).split(" ").filter((token) => token.length >= 3);
  const blob = normalizeText([
    row.title,
    row.description,
    row.ai_summary,
    ...normalizeJsonArray(row.authors).map((item) => item?.full_name || ""),
    ...normalizeJsonArray(row.genres).map((item) => item?.name || ""),
    ...(Array.isArray(row.ai_topics) ? row.ai_topics : []),
    ...(Array.isArray(row.ai_keywords) ? row.ai_keywords : []),
  ].join(" "));

  if (!tokens.length) return 0;
  const matched = tokens.filter((token) => blob.includes(token));
  return matched.length / Math.max(tokens.length, 1);
}

async function runTextFallback(supabase, query, limit, filters) {
  const { data, error } = await supabase
    .from("book_catalog_view")
    .select("*")
    .eq("is_active", true)
    .limit(200);

  if (error) throw error;

  return (data || [])
    .map((row) => ({ row, score: textFallbackScore(row, query) }))
    .filter(({ score }) => score > 0)
    .filter(({ row }) => !filters.format || row.format === filters.format)
    .filter(({ row }) => filters.minPrice == null || Number(row.price || 0) >= filters.minPrice)
    .filter(({ row }) => filters.maxPrice == null || Number(row.price || 0) <= filters.maxPrice)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score }) => mapCatalogFallback(row, score, query));
}

function makeReasons(row, query, similarity, fallback = false) {
  const reasons = [];
  const queryText = normalizeText(query);
  const topics = Array.isArray(row.topics) ? row.topics : Array.isArray(row.ai_topics) ? row.ai_topics : [];
  const keywords = Array.isArray(row.keywords) ? row.keywords : Array.isArray(row.ai_keywords) ? row.ai_keywords : [];
  const genres = normalizeJsonArray(row.genres);

  const matchedTopic = topics.find((topic) => queryText.includes(normalizeText(topic)) || normalizeText(topic).split(" ").some((part) => part.length > 3 && queryText.includes(part)));
  if (matchedTopic) reasons.push(`совпадает тема: ${matchedTopic}`);

  const matchedKeyword = keywords.find((keyword) => queryText.includes(normalizeText(keyword)));
  if (matchedKeyword && reasons.length < 3) reasons.push(`совпадает ключевое слово: ${matchedKeyword}`);

  if (similarity >= 0.7 && reasons.length < 3) reasons.push("высокая смысловая близость к запросу");
  if (genres[0]?.name && reasons.length < 3) reasons.push(`подходит по жанру: ${genres[0].name}`);
  if (reasons.length < 3) reasons.push(fallback ? "найдено обычным текстовым поиском" : "близко к запросу по смысловому описанию");

  return Array.from(new Set(reasons)).slice(0, 3);
}

function mapSemanticRow(row, query) {
  const genres = normalizeJsonArray(row.genres);
  const topics = Array.isArray(row.topics) ? row.topics : [];
  const keywords = Array.isArray(row.keywords) ? row.keywords : [];
  return {
    bookId: row.book_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    price: Number(row.price || 0),
    format: row.format,
    coverUrl: row.cover_url,
    rating: Number(row.rating || 0),
    stockQty: Number(row.stock_qty || 0),
    isActive: row.is_active !== false,
    authors: normalizeJsonArray(row.authors),
    genres,
    similarity: Number(row.similarity || 0),
    aiSummary: row.ai_summary,
    topics,
    keywords,
    complexityLevel: row.complexity_level,
    emotionalTone: row.emotional_tone,
    reasons: makeReasons(row, query, Number(row.similarity || 0), false),
  };
}

function mapCatalogFallback(row, score, query) {
  const mapped = {
    book_id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    price: row.price,
    format: row.format,
    cover_url: row.cover_url,
    rating: row.rating,
    stock_qty: row.stock_qty,
    is_active: row.is_active,
    authors: row.authors,
    genres: row.genres,
    similarity: score,
    ai_summary: row.ai_summary,
    topics: Array.isArray(row.ai_topics) ? row.ai_topics : [],
    keywords: Array.isArray(row.ai_keywords) ? row.ai_keywords : [],
    complexity_level: row.complexity_level,
    emotional_tone: row.emotional_tone,
  };
  const item = mapSemanticRow(mapped, query);
  return { ...item, reasons: makeReasons(mapped, query, score, true) };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Метод не поддерживается." });

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "Некорректный JSON в теле запроса." });
  }

  const query = String(body?.query || "").replace(/\s+/g, " ").trim();
  if (query.length < 3) return json(res, 400, { ok: false, error: "Введите запрос длиной не менее 3 символов." });
  if (query.length > MAX_QUERY_LENGTH) return json(res, 400, { ok: false, error: `Запрос слишком длинный. Максимум: ${MAX_QUERY_LENGTH} символов.` });

  const { supabaseUrl, supabaseKey } = serverConfig();
  if (!supabaseUrl || !supabaseKey) {
    return json(res, 500, { ok: false, error: "Серверная функция смыслового поиска не настроена." });
  }

  const limit = clampLimit(body?.limit);
  const filters = normalizeFilters(body?.filters);
  const minSimilarity = Number.isFinite(Number(body?.minSimilarity)) ? Number(body.minSimilarity) : DEFAULT_MIN_SIMILARITY;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const embeddingConfig = getEmbeddingConfig();
    const { embedding } = await createTextEmbedding(embeddingConfig, query, { dimension: embeddingConfig.embeddingDimension, timeoutMs: 18000 });

    const { data, error } = await supabase.rpc("match_books_semantic", {
      p_query_embedding: toVectorLiteral(embedding),
      p_limit: limit,
      p_min_similarity: minSimilarity,
      p_genre_id: filters.genreId,
      p_format: filters.format,
      p_min_price: filters.minPrice,
      p_max_price: filters.maxPrice,
      p_only_active: true,
    });

    if (error) throw error;

    const items = (data || []).map((row) => mapSemanticRow(row, query));
    return json(res, 200, { ok: true, query, mode: "semantic", fallback: false, items });
  } catch (error) {
    try {
      const items = await runTextFallback(supabase, query, limit, filters);
      return json(res, 200, {
        ok: true,
        query,
        mode: "text-fallback",
        fallback: true,
        message: "Смысловой поиск временно недоступен, показаны результаты обычного поиска.",
        items,
      });
    } catch {
      return json(res, 503, {
        ok: false,
        query,
        mode: "semantic",
        fallback: false,
        error: "Смысловой поиск временно недоступен. Попробуйте позже или используйте обычный поиск.",
      });
    }
  }
}
