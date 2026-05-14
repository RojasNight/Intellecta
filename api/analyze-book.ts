import { createClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
const MAX_PROVIDER_TEXT_LENGTH = 8000;
const MAX_ERROR_LENGTH = 500;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function readEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function getServerConfig() {
  return {
    supabaseUrl: readEnv(["SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]),
    serviceRoleKey: readEnv(["SUPABASE_SERVICE_ROLE_KEY"]),
    openRouterApiKey: readEnv(["OPENROUTER_API_KEY"]),
    openRouterModel: readEnv(["OPENROUTER_MODEL"]) || "openrouter/free",
    openRouterEmbeddingModel: readEnv(["OPENROUTER_EMBEDDING_MODEL"]),
    appUrl: readEnv(["APP_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"]),
  };
}

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

function extractBearerToken(req) {
  const raw = req.headers.authorization || req.headers.Authorization || "";
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim() || "";
}

function redactSensitive(value) {
  return String(value || "")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9._-]+/g, "[redacted-jwt]")
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, "[redacted-openrouter-key]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-key]")
    .replace(/SUPABASE_SERVICE_ROLE_KEY|OPENROUTER_API_KEY|Authorization/gi, "[redacted]");
}

function safeErrorMessage(error, fallback = "Не удалось выполнить ИИ-анализ книги.") {
  if (error instanceof HttpError) return error.message.slice(0, MAX_ERROR_LENGTH);

  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = redactSensitive(raw).trim();
  const lower = message.toLowerCase();

  if (lower.includes("book has no description") || lower.includes("описан") || lower.includes("text fragment")) {
    return "Book has no description or text fragment for AI analysis";
  }
  if (lower.includes("book not found") || lower.includes("книга не найд")) return "Книга не найдена.";
  if (lower.includes("permission") || lower.includes("forbidden") || lower.includes("admin") || lower.includes("42501")) {
    return "Недостаточно прав для запуска ИИ-анализа.";
  }
  if (lower.includes("environment") || lower.includes("service role") || lower.includes("supabase")) {
    return "Серверная функция ИИ-анализа не настроена.";
  }

  if (!message) return fallback;
  if (/select\s|insert\s|update\s|delete\s|from\s|where\s/i.test(message)) return fallback;
  return message.slice(0, MAX_ERROR_LENGTH);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то", "все", "она", "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за", "бы", "по", "ее", "мне", "было", "вот", "от", "меня", "еще", "нет", "о", "из", "ему", "теперь", "когда", "даже", "ну", "ли", "если", "уже", "или", "ни", "быть", "был", "него", "до", "вас", "нибудь", "опять", "уж", "вам", "ведь", "там", "потом", "себя", "ничего", "ей", "может", "они", "тут", "где", "есть", "надо", "ней", "для", "мы", "тебя", "их", "чем", "была", "сам", "чтоб", "без", "будто", "чего", "раз", "тоже", "себе", "под", "будет", "тогда", "кто", "этот", "того", "потому", "этого", "какой", "совсем", "ним", "здесь", "этом", "один", "почти", "мой", "тем", "чтобы", "нее", "сейчас", "были", "куда", "зачем", "всех", "никогда", "можно", "при", "наконец", "об", "другой", "хоть", "после", "над", "больше", "тот", "через", "эти", "нас", "про", "всего", "них", "какая", "много", "разве", "эту", "моя", "впрочем", "хорошо", "свою", "этой", "перед", "иногда", "лучше", "чуть", "том", "нельзя", "такой", "им", "более", "всегда", "конечно", "всю", "между",
  "the", "and", "for", "with", "that", "this", "from", "into", "about", "over", "under", "book", "novel",
]);

function wordsFrom(text) {
  return normalizeText(text)
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

function extractKeywords(text, limit = 12) {
  const counts = new Map();
  for (const word of wordsFrom(text)) counts.set(word, (counts.get(word) || 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
    .slice(0, limit)
    .map(([word]) => word.toLowerCase());
}

function sentenceSummary(description, { title, authors, genres }) {
  const cleanDescription = String(description || "").replace(/\s+/g, " ").trim();
  const sentences = cleanDescription.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  const base = sentences.slice(0, 2).join(" ").trim();
  if (base) return base.length > 420 ? `${base.slice(0, 419).trim()}…` : base;

  const authorText = authors.length ? ` автора ${authors.join(", ")}` : "";
  const genreText = genres.length ? ` в жанрах: ${genres.join(", ")}` : "";
  return `«${title}»${authorText}${genreText}. Описание ограничено, анализ выполнен консервативно.`;
}

function complexityLevel(text) {
  const words = wordsFrom(text);
  if (words.length < 35) return 1;
  if (words.length < 90) return 2;
  if (words.length < 220) return 3;

  const avgLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  const complexWords = words.filter((word) => word.length >= 11).length;
  if (words.length > 650 || avgLength > 8.5 || complexWords > 35) return 5;
  return 4;
}

function emotionalTone(text) {
  const normalized = normalizeText(text);
  const toneRules = [
    { tone: "напряжённый", words: ["страх", "мрак", "тайна", "опасность", "угроза", "тревога", "борьба"] },
    { tone: "романтичный", words: ["любовь", "чувства", "роман", "нежность", "сердце"] },
    { tone: "динамичный", words: ["приключение", "приключения", "путешествие", "дорога", "экспедиция"] },
    { tone: "познавательный", words: ["знание", "исследование", "наука", "обучение", "теория", "метод"] },
  ];

  let best = { tone: "нейтральный", score: 0 };
  for (const item of toneRules) {
    const score = item.words.reduce((sum, word) => sum + (normalized.includes(word) ? 1 : 0), 0);
    if (score > best.score) best = { tone: item.tone, score };
  }
  return best.tone;
}

function fallbackAnalysis({ book, genres, authors }) {
  const description = book.description || "";
  const metadataText = `${book.title} ${authors.join(" ")} ${genres.join(" ")}`;
  const keywords = Array.from(new Set([
    ...extractKeywords(description, 15),
    ...extractKeywords(metadataText, 10),
  ])).slice(0, 15);
  const safeKeywords = keywords.length >= 5
    ? keywords
    : Array.from(new Set([...keywords, "книга", "чтение", "сюжет", "автор", "каталог"])).slice(0, 15);
  const topics = Array.from(new Set([...genres, ...safeKeywords.slice(0, Math.max(0, 8 - genres.length))]))
    .filter(Boolean)
    .slice(0, 8);

  return {
    summary: sentenceSummary(description, { title: book.title, authors, genres }),
    topics: topics.length >= 3 ? topics : Array.from(new Set([...topics, "литература", "книги", "чтение"])).slice(0, 8),
    keywords: safeKeywords,
    complexity_level: complexityLevel(description),
    emotional_tone: emotionalTone(description),
    embedding: null,
  };
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim());
}

function validateProviderAnalysis(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.summary !== "string" || !value.summary.trim()) return null;
  if (!isStringArray(value.topics) || value.topics.length < 3 || value.topics.length > 8) return null;
  if (!isStringArray(value.keywords) || value.keywords.length < 5 || value.keywords.length > 15) return null;
  if (!Number.isFinite(Number(value.complexity_level))) return null;

  const complexity = Number(value.complexity_level);
  if (!Number.isInteger(complexity) || complexity < 1 || complexity > 5) return null;
  if (typeof value.emotional_tone !== "string" || !value.emotional_tone.trim()) return null;

  return {
    summary: value.summary.trim().slice(0, 1200),
    topics: value.topics.map((item) => item.trim()).filter(Boolean).slice(0, 8),
    keywords: value.keywords.map((item) => item.trim().toLowerCase()).filter(Boolean).slice(0, 15),
    complexity_level: complexity,
    emotional_tone: value.emotional_tone.trim().slice(0, 80),
  };
}

async function fetchJsonWithTimeout(url, options, timeoutMs = 25000) {
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
    return { response, jsonBody };
  } finally {
    clearTimeout(timeout);
  }
}

function openRouterHeaders(config) {
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

function getOpenRouterSystemPrompt() {
  return `You analyze books for a Russian-language book catalog.
Return only valid JSON.
Do not include markdown.
Do not include comments.
Do not include explanations.
Do not invent facts that are not supported by the provided book data.
If data is limited, produce a conservative analysis.

Required JSON schema:
{
  "summary": "string",
  "topics": ["string"],
  "keywords": ["string"],
  "complexity_level": 1,
  "emotional_tone": "string"
}

Rules:
- summary: 1-3 short Russian sentences.
- topics: 3-8 short Russian topic labels.
- keywords: 5-15 lowercase Russian keywords.
- complexity_level: integer from 1 to 5.
- emotional_tone: short Russian label, for example: "спокойный", "мрачный", "ироничный", "романтичный", "напряжённый", "познавательный".
- Use Russian language.
- Output must be parseable JSON only.`;
}

function getOpenRouterUserPrompt({ book, genres, authors }) {
  return `Analyze this book for a catalog.

Book data:
Title: ${book.title || ""}
Author: ${authors.join(", ") || ""}
Genres: ${genres.join(", ") || ""}
Description:
${String(book.description || "").slice(0, MAX_PROVIDER_TEXT_LENGTH)}

Text fragment:


Return only JSON according to the required schema.`;
}

async function callOpenRouterAnalysis(config, context) {
  if (!config.openRouterApiKey) return { analysis: fallbackAnalysis(context), fallbackUsed: true };

  try {
    const { response, jsonBody } = await fetchJsonWithTimeout(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: openRouterHeaders(config),
      body: JSON.stringify({
        model: config.openRouterModel,
        temperature: 0.2,
        messages: [
          { role: "system", content: getOpenRouterSystemPrompt() },
          { role: "user", content: getOpenRouterUserPrompt(context) },
        ],
      }),
    });

    if (!response.ok) return { analysis: fallbackAnalysis(context), fallbackUsed: true };

    const content = jsonBody?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { analysis: fallbackAnalysis(context), fallbackUsed: true };

    const parsed = JSON.parse(content.trim());
    const validated = validateProviderAnalysis(parsed);
    if (!validated) return { analysis: fallbackAnalysis(context), fallbackUsed: true };

    return { analysis: { ...validated, embedding: null }, fallbackUsed: false };
  } catch {
    return { analysis: fallbackAnalysis(context), fallbackUsed: true };
  }
}

function validateEmbedding(value) {
  if (!Array.isArray(value)) return null;
  const vector = value.map(Number);
  if (!vector.length || vector.some((item) => !Number.isFinite(item))) return null;
  return vector;
}

async function callOpenRouterEmbedding(config, profile, context) {
  if (!config.openRouterApiKey || !config.openRouterEmbeddingModel) return null;

  const input = [
    context.book.title,
    context.authors.join(", "),
    context.genres.join(", "),
    profile.summary,
    profile.topics.join(", "),
    profile.keywords.join(", "),
  ].join("\n").slice(0, 6000);

  try {
    const { response, jsonBody } = await fetchJsonWithTimeout(OPENROUTER_EMBEDDINGS_URL, {
      method: "POST",
      headers: openRouterHeaders(config),
      body: JSON.stringify({
        model: config.openRouterEmbeddingModel,
        input,
      }),
    }, 20000);

    if (!response.ok) return null;
    return validateEmbedding(jsonBody?.data?.[0]?.embedding);
  } catch {
    return null;
  }
}

function toVectorLiteral(embedding) {
  return `[${embedding.map((item) => Number(item).toString()).join(",")}]`;
}

async function upsertProfileWithEmbeddingRetry(supabase, profile) {
  const { error } = await supabase
    .from("book_ai_profiles")
    .upsert(profile, { onConflict: "book_id" });

  if (!error) return profile;

  if (Array.isArray(profile.embedding) && /embedding|vector|json|invalid input/i.test(error.message || "")) {
    const vectorLiteralProfile = { ...profile, embedding: toVectorLiteral(profile.embedding) };
    const { error: vectorError } = await supabase
      .from("book_ai_profiles")
      .upsert(vectorLiteralProfile, { onConflict: "book_id" });

    if (!vectorError) return vectorLiteralProfile;

    const nullEmbeddingProfile = { ...profile, embedding: null };
    const { error: nullError } = await supabase
      .from("book_ai_profiles")
      .upsert(nullEmbeddingProfile, { onConflict: "book_id" });

    if (!nullError) return nullEmbeddingProfile;
    throw nullError;
  }

  throw error;
}

async function loadBookContext(supabase, bookId) {
  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, title, description, is_active")
    .eq("id", bookId)
    .maybeSingle();

  if (bookError) throw bookError;
  if (!book) throw new HttpError(404, "Книга не найдена.");

  const [{ data: genreRows }, { data: authorRows }] = await Promise.all([
    supabase.from("book_genres").select("genres(name)").eq("book_id", bookId),
    supabase.from("book_authors").select("authors(full_name)").eq("book_id", bookId),
  ]);

  const pickRelated = (value) => Array.isArray(value) ? value[0] : value;
  const genres = (genreRows || [])
    .map((row) => pickRelated(row?.genres)?.name)
    .filter(Boolean);
  const authors = (authorRows || [])
    .map((row) => pickRelated(row?.authors)?.full_name)
    .filter(Boolean);

  return { book, genres, authors };
}

async function createJob(supabase, bookId) {
  const { data: job, error } = await supabase
    .from("ai_analysis_jobs")
    .insert({
      book_id: bookId,
      status: "running",
      started_at: new Date().toISOString(),
      finished_at: null,
      error_message: null,
    })
    .select("id, book_id, status, started_at, finished_at, error_message, created_at")
    .single();

  if (error) throw error;
  return job;
}

async function markJobFailed(supabase, jobId, errorMessage) {
  if (!jobId) return null;
  const { data } = await supabase
    .from("ai_analysis_jobs")
    .update({ status: "failed", finished_at: new Date().toISOString(), error_message: errorMessage.slice(0, MAX_ERROR_LENGTH) })
    .eq("id", jobId)
    .select("id, book_id, status, started_at, finished_at, error_message, created_at")
    .maybeSingle();
  return data;
}

function publicProfilePayload(profile) {
  return {
    ...profile,
    embedding: Array.isArray(profile.embedding) ? profile.embedding : null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Метод не поддерживается." });

  const config = getServerConfig();
  if (!config.supabaseUrl || !config.serviceRoleKey) {
    return json(res, 500, { ok: false, error: "Серверная функция ИИ-анализа не настроена." });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "Некорректный JSON в теле запроса." });
  }

  const bookId = typeof body?.bookId === "string" ? body.bookId.trim() : "";
  if (!bookId) return json(res, 400, { ok: false, error: "bookId обязателен." });
  if (!UUID_RE.test(bookId)) return json(res, 400, { ok: false, error: "Некорректный идентификатор книги." });

  const token = extractBearerToken(req);
  if (!token) return json(res, 401, { ok: false, error: "Требуется авторизация." });

  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let jobId = null;

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) throw new HttpError(401, "Сессия недействительна.");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (profile?.role !== "admin") throw new HttpError(403, "Недостаточно прав для запуска ИИ-анализа.");

    const context = await loadBookContext(supabase, bookId);
    const job = await createJob(supabase, bookId);
    jobId = job.id;

    const textForAnalysis = String(context.book.description || "").trim();
    if (!textForAnalysis) {
      throw new HttpError(400, "Book has no description or text fragment for AI analysis");
    }

    await supabase
      .from("book_ai_profiles")
      .upsert({ book_id: bookId, status: "running", updated_at: new Date().toISOString() }, { onConflict: "book_id" });

    const { analysis, fallbackUsed } = await callOpenRouterAnalysis(config, context);
    const embedding = fallbackUsed ? null : await callOpenRouterEmbedding(config, analysis, context);

    const profilePayload = {
      book_id: bookId,
      summary: analysis.summary,
      topics: analysis.topics,
      keywords: analysis.keywords,
      complexity_level: analysis.complexity_level,
      emotional_tone: analysis.emotional_tone,
      embedding,
      status: "ready",
      updated_at: new Date().toISOString(),
    };

    const savedProfile = await upsertProfileWithEmbeddingRetry(supabase, profilePayload);

    const { data: updatedJob, error: readyError } = await supabase
      .from("ai_analysis_jobs")
      .update({ status: "ready", finished_at: new Date().toISOString(), error_message: null })
      .eq("id", jobId)
      .select("id, book_id, status, started_at, finished_at, error_message, created_at")
      .single();

    if (readyError) throw readyError;

    return json(res, 200, {
      ok: true,
      job: updatedJob,
      profile: publicProfilePayload(savedProfile),
      fallbackUsed,
    });
  } catch (error) {
    const safeMessage = safeErrorMessage(error);
    const failedJob = await markJobFailed(supabase, jobId, safeMessage).catch(() => null);

    if (jobId) {
      try {
        await supabase
          .from("book_ai_profiles")
          .upsert({ book_id: bookId, status: "failed", updated_at: new Date().toISOString() }, { onConflict: "book_id" });
      } catch {
        // Do not expose secondary logging/storage failures to the client.
      }
    }

    const status = error instanceof HttpError
      ? error.status
      : /книга не найд/i.test(safeMessage)
        ? 404
        : /description|описан|text fragment|текст/i.test(safeMessage)
          ? 400
          : 500;

    return json(res, status, { ok: false, error: safeMessage, job: failedJob ?? undefined });
  }
}
