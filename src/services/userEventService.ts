import { getSupabaseClient } from "../lib/supabase";
import type { UserEventRow, UserEventType } from "../app/components/types";

export type UserEventPayload = Record<string, unknown>;

type UserEventInsert = {
  user_id: string | null;
  book_id?: string | null;
  event_type: UserEventType;
  event_payload: UserEventPayload;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SEARCH_QUERY_LENGTH = 200;

function debugEventError(source: string, error: unknown) {
  if (!import.meta.env.DEV) return;

  const value = error as { code?: string; message?: string; details?: string | null; hint?: string | null } | null;
  console.error(`[Интеллекта][user-events] ${source}`, {
    code: value?.code,
    message: value?.message ?? (error instanceof Error ? error.message : String(error ?? "")),
    details: value?.details,
    hint: value?.hint,
  });
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function trimText(value: string, maxLength = MAX_SEARCH_QUERY_LENGTH) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function sanitizePayload(payload: UserEventPayload): UserEventPayload {
  const clean: UserEventPayload = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (typeof value === "string") {
      const trimmed = trimText(value, key === "query" ? MAX_SEARCH_QUERY_LENGTH : 120);
      if (trimmed) clean[key] = trimmed;
      return;
    }

    if (typeof value === "number") {
      if (Number.isFinite(value)) clean[key] = value;
      return;
    }

    if (typeof value === "boolean") {
      clean[key] = value;
    }
  });

  return clean;
}

async function getSessionUserId(): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    debugEventError("session:error", error);
    return null;
  }

  return data.session?.user.id ?? null;
}

async function insertUserEvent(event: UserEventInsert): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("user_events").insert(event);

    if (error) {
      debugEventError(`${event.event_type}:insert:error`, error);
    }
  } catch (error) {
    debugEventError(`${event.event_type}:unexpected:error`, error);
  }
}

export async function logUserEvent(
  eventType: UserEventType,
  payload: UserEventPayload = {},
  bookId?: string | null,
): Promise<void> {
  try {
    const userId = await getSessionUserId();
    const safePayload = sanitizePayload(payload);
    const safeBookId = isUuid(bookId) ? bookId : null;

    await insertUserEvent({
      user_id: userId,
      book_id: safeBookId,
      event_type: eventType,
      event_payload: safePayload,
    });
  } catch (error) {
    debugEventError(`${eventType}:log:error`, error);
  }
}

export function logBookView(bookId: string): Promise<void> {
  return logUserEvent("book_view", { book_id: bookId }, bookId);
}

export function logSearch(query: string): Promise<void> {
  const safeQuery = trimText(query);
  if (!safeQuery) return Promise.resolve();
  return logUserEvent("search", { query: safeQuery });
}

export function logFavoriteAdd(bookId: string): Promise<void> {
  return logUserEvent("favorite_add", { book_id: bookId }, bookId);
}

export function logFavoriteRemove(bookId: string): Promise<void> {
  return logUserEvent("favorite_remove", { book_id: bookId }, bookId);
}

export function logCartAdd(bookId: string, quantity: number): Promise<void> {
  const safeQuantity = Number.isFinite(quantity) ? Math.max(1, Math.trunc(quantity)) : 1;
  return logUserEvent("cart_add", { book_id: bookId, quantity: safeQuantity }, bookId);
}

export function logCartRemove(bookId: string): Promise<void> {
  return logUserEvent("cart_remove", { book_id: bookId }, bookId);
}

export function logPurchase(orderId: string): Promise<void> {
  return logUserEvent("purchase", { order_id: orderId });
}

export function logRecommendationClick(bookId: string, recommendationId: string): Promise<void> {
  return logUserEvent(
    "recommendation_click",
    { book_id: bookId, recommendation_id: recommendationId },
    bookId,
  );
}

export function normalizeUserEventRow(row: unknown): UserEventRow | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  if (typeof value.id !== "string" || typeof value.event_type !== "string") return null;

  return {
    id: value.id,
    user_id: typeof value.user_id === "string" ? value.user_id : null,
    book_id: typeof value.book_id === "string" ? value.book_id : undefined,
    event_type: value.event_type as UserEventType,
    event_payload: value.event_payload && typeof value.event_payload === "object"
      ? value.event_payload as UserEventPayload
      : {},
    created_at: typeof value.created_at === "string" ? value.created_at : undefined,
  };
}
