import { createClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    openAiKey: readEnv(["OPENAI_API_KEY"]),
    openAiChatModel: readEnv(["OPENAI_CHAT_MODEL"]) || "gpt-4o-mini",
    openAiEmbeddingModel: readEnv(["OPENAI_EMBEDDING_MODEL"]) || "text-embedding-3-small",
    requireExternalAi: readEnv(["AI_ANALYSIS_REQUIRE_EXTERNAL"]).toLowerCase() === "true",
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

function safeErrorMessage(error, fallback = "Не удалось выполнить ИИ-анализ книги.") {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]").replace(/eyJ[a-zA-Z0-9._-]+/g, "[redacted]");

  if (/description|описан|text|текст/i.test(message)) return "У книги нет описания для анализа.";
  if (/book not found|книга не найд/i.test(message)) return "Книга не найдена.";
  if (/admin|permission|forbidden|прав/i.test(message)) return "Недостаточно прав для запуска ИИ-анализа.";
  if (/service role|env|environment|supabase/i.test(message)) return "Серверная функция ИИ-анализа не настроена.";
  if (/openai|ai api|external ai/i.test(message)) return "Внешний ИИ-сервис недоступен. Повторите запуск позже.";
  if (message && message.length <= 240) return message;
  return fallback;
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
  "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то", "все", "она", "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за", "бы", "по", "ее", "мне", "было", "вот", "от", "меня", "еще", "нет", "о", "из", "ему", "теперь", "когда", "даже", "ну", "вдруг", "ли", "если", "уже", "или", "ни", "быть", "был", "него", "до", "вас", "нибудь", "опять", "уж", "вам", "ведь", "там", "потом", "себя", "ничего", "ей", "может", "они", "тут", "где", "есть", "надо", "ней", "для", "мы", "тебя", "их", "чем", "была", "сам", "чтоб", "без", "будто", "чего", "раз", "тоже", "себе", "под", "будет", "ж", "тогда", "кто", "этот", "того", "потому", "этого", "какой", "совсем", "ним", "здесь", "этом", "один", "почти", "мой", "тем", "чтобы", "нее", "сейчас", "были", "куда", "зачем", "всех", "никогда", "можно", "при", "наконец", "два", "об", "другой", "хоть", "после", "над", "больше", "тот", "через", "эти", "нас", "про", "всего", "них", "какая", "много", "разве", "три", "эту", "моя", "впрочем", "хорошо", "свою", "этой", "перед", "иногда", "лучше", "чуть", "том", "нельзя", "такой", "им", "более", "всегда", "конечно", "всю", "между",
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
    .map(([word]) => word);
}

function sentenceSummary(text, maxLength = 420) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const summary = sentences.slice(0, 3).join(" ").trim();
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 1).trim()}…` : summary;
}

function complexityLevel(text) {
  const words = wordsFrom(text);
  if (!words.length) return 1;
  const avgLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  const technicalHits = words.filter((word) => /[а-яa-z]{10,}/i.test(word)).length;
  const score = (words.length > 900 ? 2 : words.length > 450 ? 1 : 0) + (avgLength > 8 ? 1 : 0) + (technicalHits > 20 ? 1 : 0);
  return Math.min(5, Math.max(1, 2 + score));
}

function emotionalTone(text) {
  const normalized = normalizeText(text);
  const tones = [
    { tone: "вдохновляющий", words: ["надежда", "рост", "мечта", "вдохновение", "свобода", "развитие", "путь"] },
    { tone: "напряженный", words: ["опасность", "страх", "конфликт", "борьба", "тайна", "угроза", "риск"] },
    { tone: "аналитический", words: ["исследование", "система", "анализ", "метод", "данные", "теория", "модель"] },
    { tone: "созерцательный", words: ["память", "время", "размышление", "смысл", "тишина", "внутренний", "жизнь"] },
  ];

  let best = { tone: "нейтральный", score: 0 };
  for (const item of tones) {
    const score = item.words.reduce((sum, word) => sum + (normalized.includes(word) ? 1 : 0), 0);
    if (score > best.score) best = { tone: item.tone, score };
  }
  return best.tone;
}

function fallbackAnalysis({ book, genres }) {
  const text = `${book.title}. ${book.description || ""}`;
  const keywords = extractKeywords(text, 12);
  const genreTopics = genres.map((genre) => String(genre || "").trim()).filter(Boolean);
  const topics = Array.from(new Set([...genreTopics, ...keywords.slice(0, 6)])).slice(0, 8);

  return {
    summary: sentenceSummary(book.description || book.title),
    topics,
    keywords,
    complexity_level: complexityLevel(book.description || ""),
    emotional_tone: emotionalTone(book.description || ""),
    embedding: null,
    provider: "fallback",
  };
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : fallback;
}

function normalizeAnalysis(raw, fallback) {
  return {
    summary: String(raw?.summary || fallback.summary || "").trim().slice(0, 1200),
    topics: ensureArray(raw?.topics, fallback.topics).slice(0, 10),
    keywords: ensureArray(raw?.keywords, fallback.keywords).slice(0, 16),
    complexity_level: Math.min(5, Math.max(1, Number(raw?.complexity_level || fallback.complexity_level || 2))),
    emotional_tone: String(raw?.emotional_tone || fallback.emotional_tone || "нейтральный").trim().slice(0, 80),
  };
}

async function callOpenAIAnalysis(config, { book, genres, authors }) {
  const fallback = fallbackAnalysis({ book, genres });
  if (!config.openAiKey) return fallback;

  const prompt = [
    "Проанализируй книгу для книжного интернет-магазина с объяснимыми рекомендациями.",
    "Верни строго JSON без markdown со схемой:",
    "{ summary: string, topics: string[], keywords: string[], complexity_level: number 1..5, emotional_tone: string }.",
    "Темы и ключевые слова должны быть короткими, на русском языке, без рекламных формулировок.",
    `Название: ${book.title}`,
    `Авторы: ${authors.join(", ") || "не указаны"}`,
    `Жанры: ${genres.join(", ") || "не указаны"}`,
    `Описание: ${(book.description || "").slice(0, 8000)}`,
  ].join("\n");

  try {
    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.openAiChatModel,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Ты выполняешь структурированный семантический анализ книг для рекомендательной системы." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!chatResponse.ok) throw new Error(`OpenAI analysis failed: ${chatResponse.status}`);
    const chatJson = await chatResponse.json();
    const content = chatJson?.choices?.[0]?.message?.content || "{}";
    const parsed = normalizeAnalysis(JSON.parse(content), fallback);

    let embedding = null;
    const embeddingInput = [book.title, parsed.summary, parsed.topics.join(", "), parsed.keywords.join(", ")].join("\n");
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.openAiEmbeddingModel,
        input: embeddingInput.slice(0, 6000),
      }),
    });

    if (embeddingResponse.ok) {
      const embeddingJson = await embeddingResponse.json();
      embedding = embeddingJson?.data?.[0]?.embedding || null;
    }

    return { ...parsed, embedding, provider: "openai" };
  } catch (error) {
    if (config.requireExternalAi) throw error;
    return fallback;
  }
}

async function updateProfileWithRetry(supabase, profile) {
  const { error } = await supabase
    .from("book_ai_profiles")
    .upsert(profile, { onConflict: "book_id" });

  if (!error) return;

  if (profile.embedding !== null && /embedding|vector|json/i.test(error.message || "")) {
    const { error: retryError } = await supabase
      .from("book_ai_profiles")
      .upsert({ ...profile, embedding: null }, { onConflict: "book_id" });
    if (!retryError) return;
    throw retryError;
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
  if (!book) throw new Error("Book not found");

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

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method !== "POST") return json(res, 405, { error: "Метод не поддерживается." });

  const config = getServerConfig();
  if (!config.supabaseUrl || !config.serviceRoleKey) {
    return json(res, 500, { error: "Серверная функция ИИ-анализа не настроена." });
  }

  const token = extractBearerToken(req);
  if (!token) return json(res, 401, { error: "Требуется авторизация." });

  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let jobId = null;
  let bookId = null;

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) return json(res, 401, { error: "Сессия недействительна." });

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (profile?.role !== "admin") return json(res, 403, { error: "Недостаточно прав для запуска ИИ-анализа." });

    const body = await parseBody(req);
    bookId = String(body?.bookId || body?.book_id || "").trim();
    if (!UUID_RE.test(bookId)) return json(res, 400, { error: "Некорректный идентификатор книги." });

    const { book, genres, authors } = await loadBookContext(supabase, bookId);

    const { data: job, error: jobError } = await supabase
      .from("ai_analysis_jobs")
      .insert({
        book_id: bookId,
        status: "running",
        started_at: new Date().toISOString(),
        error_message: null,
      })
      .select("id, book_id, status, started_at, finished_at, error_message, created_at")
      .single();

    if (jobError) throw jobError;
    jobId = job.id;

    if (!String(book.description || "").trim()) {
      throw new Error("У книги нет описания для анализа.");
    }

    await supabase
      .from("book_ai_profiles")
      .upsert({
        book_id: bookId,
        status: "running",
        updated_at: new Date().toISOString(),
      }, { onConflict: "book_id" });

    const analysis = await callOpenAIAnalysis(config, { book, genres, authors });
    const profilePayload = {
      book_id: bookId,
      summary: analysis.summary,
      topics: analysis.topics,
      keywords: analysis.keywords,
      complexity_level: analysis.complexity_level,
      emotional_tone: analysis.emotional_tone,
      embedding: analysis.embedding,
      status: "ready",
      updated_at: new Date().toISOString(),
    };

    await updateProfileWithRetry(supabase, profilePayload);

    const { data: updatedJob, error: readyError } = await supabase
      .from("ai_analysis_jobs")
      .update({ status: "ready", finished_at: new Date().toISOString(), error_message: null })
      .eq("id", jobId)
      .select("id, book_id, status, started_at, finished_at, error_message, created_at")
      .single();

    if (readyError) throw readyError;

    return json(res, 200, {
      job: updatedJob,
      profile: { ...profilePayload, embedding: Array.isArray(profilePayload.embedding) ? { dimensions: profilePayload.embedding.length } : null },
      provider: analysis.provider,
    });
  } catch (error) {
    const safeMessage = safeErrorMessage(error);

    try {
      if (jobId) {
        await supabase
          .from("ai_analysis_jobs")
          .update({ status: "failed", finished_at: new Date().toISOString(), error_message: safeMessage })
          .eq("id", jobId);
      }

      if (bookId && UUID_RE.test(bookId) && jobId) {
        await supabase
          .from("book_ai_profiles")
          .upsert({ book_id: bookId, status: "failed", updated_at: new Date().toISOString() }, { onConflict: "book_id" });
      }
    } catch {
      // Do not leak secondary logging failures to the client.
    }

    const status = /книга не найд/i.test(safeMessage) ? 404 : /описан|текст/i.test(safeMessage) ? 400 : 500;
    return json(res, status, { error: safeMessage, jobId });
  }
}
