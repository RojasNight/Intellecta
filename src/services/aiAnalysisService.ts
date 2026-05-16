import { getSupabaseClient } from "../lib/supabase";
import type { AIJobRow, AIJobStatus } from "../app/components/types";

export type { AIJobRow, AIJobStatus } from "../app/components/types";

export interface BookAIProfile {
  book_id: string;
  summary: string;
  topics: string[];
  keywords: string[];
  complexity_level: number;
  emotional_tone: string;
  embedding?: null;
  has_embedding?: boolean;
  embedding_model?: string | null;
  embedding_dimension?: number | null;
  embedding_updated_at?: string | null;
  embedding_status?: "missing" | "ready" | "failed" | null;
  embedding_error?: string | null;
  updated_at?: string | null;
  status?: "ready" | "stale" | "running" | "failed";
}

export interface AIAnalysisResponse {
  ok: boolean;
  job?: AIJobRow;
  profile?: BookAIProfile;
  fallbackUsed?: boolean;
  error?: string;
}

type AIJobDbRow = {
  id: string;
  book_id: string;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  error_message?: string | null;
  created_at?: string | null;
};

function normalizeJobStatus(value: string | null | undefined): AIJobStatus {
  if (value === "ready") return "ready";
  if (value === "failed" || value === "error") return "failed";
  return "running";
}

function normalizeJob(row: AIJobDbRow): AIJobRow {
  return {
    id: row.id,
    book_id: row.book_id,
    status: normalizeJobStatus(row.status),
    started_at: row.started_at ?? undefined,
    finished_at: row.finished_at ?? undefined,
    error_message: row.error_message ?? undefined,
    created_at: row.created_at ?? undefined,
  };
}

export function getAIAnalysisErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();

  if (lower.includes("authorization") || lower.includes("сесс") || lower.includes("авториза") || lower.includes("401")) {
    return "Войдите как администратор, чтобы запустить ИИ-анализ.";
  }

  if (lower.includes("admin") || lower.includes("forbidden") || lower.includes("permission") || lower.includes("прав") || lower.includes("403")) {
    return "Недостаточно прав для запуска ИИ-анализа.";
  }

  if (lower.includes("description") || lower.includes("описан") || lower.includes("text fragment") || lower.includes("текст")) {
    return "У книги нет описания или текстового фрагмента для ИИ-анализа.";
  }

  if (lower.includes("not found") || lower.includes("не найд") || lower.includes("404")) {
    return "Книга не найдена.";
  }

  if (lower.includes("server") || lower.includes("service role") || lower.includes("настро") || lower.includes("500")) {
    return "Серверная функция ИИ-анализа не настроена или временно недоступна.";
  }

  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Не удалось подключиться к серверной функции ИИ-анализа.";
  }

  return message || "Не удалось выполнить ИИ-анализ книги.";
}


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminBookIdentifierRow = {
  id?: string | null;
  slug?: string | null;
  title?: string | null;
};

function normalizeIdentifier(value: string): string {
  return value.trim();
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function sameIdentifier(left: string | null | undefined, right: string): boolean {
  if (!left) return false;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

async function resolveBookUuid(supabase: ReturnType<typeof getSupabaseClient>, rawBookId: string): Promise<string> {
  const identifier = normalizeIdentifier(rawBookId);
  if (isUuid(identifier)) return identifier;

  // Admin UI should pass books.id, but older UI builds / cached rows may pass slug or title.
  // Resolve it client-side before calling /api/analyze-book, because the server endpoint
  // intentionally accepts only UUID bookId for a strict Stage 17 contract.
  const { data, error } = await supabase.rpc("admin_get_books");
  if (error) throw new Error(getAIAnalysisErrorMessage(error));

  const rows = (data ?? []) as AdminBookIdentifierRow[];
  const match = rows.find((row) =>
    sameIdentifier(row.id, identifier)
    || sameIdentifier(row.slug, identifier)
    || sameIdentifier(row.title, identifier)
  );

  if (match?.id && isUuid(match.id)) return match.id.trim();

  throw new Error(`Frontend передал не UUID книги: ${identifier}. Проверьте, что кнопка ИИ-анализа использует books.id из Supabase.`);
}

export async function analyzeBook(bookId: string): Promise<AIAnalysisResponse> {
  if (!bookId || typeof bookId !== "string") {
    throw new Error("Некорректный идентификатор книги.");
  }

  const supabase = getSupabaseClient();
  const resolvedBookId = await resolveBookUuid(supabase, bookId);

  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(getAIAnalysisErrorMessage(error));

  const token = data.session?.access_token;
  if (!token) throw new Error("Требуется авторизация администратора.");

  const response = await fetch("/api/analyze-book", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bookId: resolvedBookId }),
  });

  const payload = await response.json().catch(() => ({ ok: false, error: "Некорректный ответ серверной функции." })) as AIAnalysisResponse;

  if (!response.ok || payload.ok === false) {
    throw new Error(getAIAnalysisErrorMessage(payload.error || `HTTP ${response.status}`));
  }

  return payload;
}

export async function getAdminAIJobs(limit = 50): Promise<AIJobRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ai_analysis_jobs")
    .select("id, book_id, status, started_at, finished_at, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(getAIAnalysisErrorMessage(error));
  return ((data ?? []) as AIJobDbRow[]).map(normalizeJob);
}
