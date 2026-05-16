import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";
const DEFAULT_EMBEDDING_DIMENSION = 1536;
const MAX_INPUT_LENGTH = 6000;

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [rawKey, ...rest] = trimmed.split("=");
    const key = rawKey.trim();
    const value = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

function env(name, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function numberEnv(name, fallback) {
  const parsed = Number(env(name));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function toVectorLiteral(vector) {
  return `[${vector.map((item) => Number(item).toString()).join(",")}]`;
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20);
}

function relatedNames(rows, relationName, fieldName) {
  const pick = (value) => Array.isArray(value) ? value[0] : value;
  return (rows || []).map((row) => pick(row?.[relationName])?.[fieldName]).filter(Boolean);
}

function buildEmbeddingInput({ book, aiProfile, authors, genres }) {
  const topics = normalizeArray(aiProfile?.topics);
  const keywords = normalizeArray(aiProfile?.keywords);
  return [
    `Название: ${book.title || ""}`,
    `Авторы: ${authors.join(", ") || "не указаны"}`,
    `Жанры: ${genres.join(", ") || "не указаны"}`,
    `Описание: ${book.description || ""}`,
    `ИИ-сводка: ${aiProfile?.summary || ""}`,
    `Темы: ${topics.join(", ")}`,
    `Ключевые слова: ${keywords.join(", ")}`,
    `Сложность: ${aiProfile?.complexity_level ?? ""}`,
    `Тон: ${aiProfile?.emotional_tone || ""}`,
  ]
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => !line.endsWith(":") && !line.endsWith(": не указаны"))
    .join("\n")
    .slice(0, MAX_INPUT_LENGTH);
}

async function createEmbedding(input, { apiKey, model, dimension }) {
  const response = await fetch(OPENROUTER_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Интеллекта",
    },
    body: JSON.stringify({ model, input, dimensions: dimension, encoding_format: "float" }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || payload?.message || `HTTP ${response.status}`);
  const embedding = payload?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== dimension) {
    throw new Error(`Embedding-модель вернула некорректную размерность: ${Array.isArray(embedding) ? embedding.length : "none"}`);
  }
  return { embedding, model: payload?.model || model };
}

async function loadContext(supabase, book) {
  const [{ data: genreRows, error: genreError }, { data: authorRows, error: authorError }, { data: aiProfile, error: profileError }] = await Promise.all([
    supabase.from("book_genres").select("genres(name)").eq("book_id", book.id),
    supabase.from("book_authors").select("authors(full_name)").eq("book_id", book.id),
    supabase.from("book_ai_profiles").select("book_id, summary, topics, keywords, complexity_level, emotional_tone, embedding_status").eq("book_id", book.id).maybeSingle(),
  ]);
  if (genreError) throw genreError;
  if (authorError) throw authorError;
  if (profileError) throw profileError;
  return {
    book,
    aiProfile: aiProfile || {
      summary: book.description || "",
      topics: [],
      keywords: [],
      complexity_level: null,
      emotional_tone: null,
    },
    genres: relatedNames(genreRows, "genres", "name"),
    authors: relatedNames(authorRows, "authors", "full_name"),
  };
}

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Math.min(Number(limitArg.split("=")[1]) || 20, 200)) : 20;
const force = process.argv.includes("--force");

const supabaseUrl = env("SUPABASE_URL", env("VITE_SUPABASE_URL"));
const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
const apiKey = env("OPENROUTER_API_KEY");
const model = env("OPENROUTER_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL);
const dimension = numberEnv("EMBEDDING_DIMENSION", DEFAULT_EMBEDDING_DIMENSION);

if (!supabaseUrl || !serviceRoleKey || !apiKey) {
  console.error("Не заданы SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY или OPENROUTER_API_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: books, error } = await supabase
  .from("books")
  .select("id, title, description, is_active")
  .eq("is_active", true)
  .limit(limit * 3);

if (error) throw error;

const report = { processed: 0, success: 0, errors: [] };

for (const book of books || []) {
  if (report.processed >= limit) break;
  try {
    const context = await loadContext(supabase, book);
    if (!force && context.aiProfile?.embedding_status === "ready") continue;

    const input = buildEmbeddingInput(context);
    if (!input) throw new Error("Недостаточно данных для embedding.");

    report.processed += 1;
    const result = await createEmbedding(input, { apiKey, model, dimension });
    const now = new Date().toISOString();

    const { error: upsertError } = await supabase
      .from("book_ai_profiles")
      .upsert({
        book_id: book.id,
        summary: context.aiProfile.summary || book.description || "",
        topics: normalizeArray(context.aiProfile.topics),
        keywords: normalizeArray(context.aiProfile.keywords),
        complexity_level: context.aiProfile.complexity_level,
        emotional_tone: context.aiProfile.emotional_tone,
        status: context.aiProfile.status || "ready",
        embedding: toVectorLiteral(result.embedding),
        embedding_model: result.model,
        embedding_dimension: dimension,
        embedding_updated_at: now,
        embedding_status: "ready",
        embedding_error: null,
        updated_at: now,
      }, { onConflict: "book_id" });

    if (upsertError) throw upsertError;
    report.success += 1;
    console.log(`OK ${book.id} — ${book.title}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report.errors.push({ book_id: book.id, title: book.title, error: message.slice(0, 300) });
    console.error(`ERR ${book.id} — ${book.title}: ${message}`);
  }
}

console.log(JSON.stringify(report, null, 2));
if (report.success === 0 && report.errors.length > 0) process.exitCode = 1;
