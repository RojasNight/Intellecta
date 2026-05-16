export const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
export const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const DEFAULT_EMBEDDING_DIMENSION = 1536;
export const MAX_EMBEDDING_INPUT_LENGTH = 6000;

export function readEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function getEmbeddingConfig() {
  const rawDimension = Number(readEnv(["EMBEDDING_DIMENSION"]));
  const embeddingDimension = Number.isInteger(rawDimension) && rawDimension > 0
    ? rawDimension
    : DEFAULT_EMBEDDING_DIMENSION;

  return {
    openRouterApiKey: readEnv(["OPENROUTER_API_KEY"]),
    openRouterEmbeddingModel: readEnv(["OPENROUTER_EMBEDDING_MODEL"]) || DEFAULT_EMBEDDING_MODEL,
    embeddingDimension,
    appUrl: readEnv(["APP_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"]),
  };
}

export function openRouterHeaders(config) {
  const headers = {
    Authorization: `Bearer ${config.openRouterApiKey}`,
    "Content-Type": "application/json",
    "X-Title": "Интеллекта",
  };

  if (config.appUrl) {
    headers["HTTP-Referer"] = config.appUrl.startsWith("http") ? config.appUrl : `https://${config.appUrl}`;
  }

  return headers;
}

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'.,!?;:()[\]{}<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

function relatedNames(rows, relationName, fieldName) {
  const pickRelated = (value) => Array.isArray(value) ? value[0] : value;
  return (rows || [])
    .map((row) => pickRelated(row?.[relationName])?.[fieldName])
    .filter(Boolean);
}

export async function fetchJsonWithTimeout(url, options, timeoutMs = 25000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let jsonBody = null;
    try {
      jsonBody = text ? JSON.parse(text) : null;
    } catch {
      jsonBody = null;
    }
    return { response, jsonBody, text };
  } finally {
    clearTimeout(timeout);
  }
}

export function validateEmbedding(value, expectedDimension) {
  if (!Array.isArray(value)) return null;
  const vector = value.map(Number);
  if (!vector.length || vector.some((item) => !Number.isFinite(item))) return null;
  if (expectedDimension && vector.length !== expectedDimension) return null;
  return vector;
}

export function toVectorLiteral(embedding) {
  return `[${embedding.map((item) => Number(item).toString()).join(",")}]`;
}

export async function createTextEmbedding(config, input, options = {}) {
  if (!config.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY не задан.");
  }
  if (!config.openRouterEmbeddingModel) {
    throw new Error("OPENROUTER_EMBEDDING_MODEL не задан.");
  }

  const dimension = Number(options.dimension || config.embeddingDimension || DEFAULT_EMBEDDING_DIMENSION);
  const cleanInput = String(input || "").replace(/\s+/g, " ").trim().slice(0, MAX_EMBEDDING_INPUT_LENGTH);
  if (!cleanInput) throw new Error("Текст для embedding пустой.");

  const { response, jsonBody, text } = await fetchJsonWithTimeout(OPENROUTER_EMBEDDINGS_URL, {
    method: "POST",
    headers: openRouterHeaders(config),
    body: JSON.stringify({
      model: config.openRouterEmbeddingModel,
      input: cleanInput,
      dimensions: dimension,
      encoding_format: "float",
    }),
  }, options.timeoutMs || 25000);

  if (!response.ok) {
    const providerMessage = jsonBody?.error?.message || jsonBody?.message || text || `HTTP ${response.status}`;
    throw new Error(`OpenRouter embeddings error: ${String(providerMessage).slice(0, 240)}`);
  }

  const embedding = validateEmbedding(jsonBody?.data?.[0]?.embedding, dimension);
  if (!embedding) {
    throw new Error(`Embedding-модель вернула вектор некорректной размерности. Ожидалось: ${dimension}.`);
  }

  return {
    embedding,
    model: jsonBody?.model || config.openRouterEmbeddingModel,
    dimension,
  };
}

export function buildBookEmbeddingInput(book, aiProfile, authors = [], genres = []) {
  const topics = normalizeList(aiProfile?.topics);
  const keywords = normalizeList(aiProfile?.keywords);
  const lines = [
    `Название: ${book?.title || ""}`,
    `Авторы: ${authors.join(", ") || "не указаны"}`,
    `Жанры: ${genres.join(", ") || "не указаны"}`,
    `Описание: ${book?.description || ""}`,
    `ИИ-сводка: ${aiProfile?.summary || ""}`,
    `Темы: ${topics.join(", ")}`,
    `Ключевые слова: ${keywords.join(", ")}`,
    `Сложность: ${aiProfile?.complexity_level ?? ""}`,
    `Тон: ${aiProfile?.emotional_tone || ""}`,
  ];

  return lines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => !line.endsWith(":") && !line.endsWith(": не указаны"))
    .join("\n")
    .slice(0, MAX_EMBEDDING_INPUT_LENGTH);
}

export async function loadBookEmbeddingContext(supabase, bookId) {
  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, title, description, slug, price, format, cover_url, stock_qty, rating, is_active")
    .eq("id", bookId)
    .maybeSingle();

  if (bookError) throw bookError;
  if (!book) throw new Error("Книга не найдена.");

  const [{ data: genreRows, error: genreError }, { data: authorRows, error: authorError }, { data: aiProfile, error: profileError }] = await Promise.all([
    supabase.from("book_genres").select("genres(id, name, slug)").eq("book_id", bookId),
    supabase.from("book_authors").select("authors(id, full_name)").eq("book_id", bookId),
    supabase.from("book_ai_profiles").select("book_id, summary, topics, keywords, complexity_level, emotional_tone, status").eq("book_id", bookId).maybeSingle(),
  ]);

  if (genreError) throw genreError;
  if (authorError) throw authorError;
  if (profileError) throw profileError;

  const genres = relatedNames(genreRows, "genres", "name");
  const authors = relatedNames(authorRows, "authors", "full_name");

  return { book, aiProfile, genres, authors };
}
