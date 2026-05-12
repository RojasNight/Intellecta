import { getSupabaseClient } from "../lib/supabase";
import { mapCatalogRowToBook, type CatalogViewRow } from "./catalogService";
import type { Book, CartItem, CartItemRow } from "../app/components/types";

export type AddToCartInput = { bookId: string; quantity?: number };
export type UpdateCartQuantityInput = { itemId?: string; bookId?: string; quantity: number };

export type CartStateSnapshot = {
  items: CartItem[];
  count: number;
  total: number;
};

type CartDbRow = {
  id: string;
  user_id: string;
  book_id: string;
  quantity: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type CartBook = Book;

const DEFAULT_MAX_QTY = 99;

function debugError(source: string, error: unknown) {
  if (!import.meta.env.DEV) return;
  const safeError = error instanceof Error ? { name: error.name, message: error.message } : error;
  console.error(`[Интеллекта][cart] ${source}`, safeError);
}

function createServiceError(message: string, cause?: unknown) {
  debugError(message, cause);
  return new Error(message);
}

async function getCurrentUserId(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw createServiceError("Не удалось проверить текущего пользователя", error);
  }

  const userId = data.user?.id;
  if (!userId) {
    throw createServiceError("Войдите, чтобы добавить книгу в корзину");
  }

  return userId;
}

function toInt(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : fallback;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  }
  return fallback;
}

function clampQuantity(quantity: number, max = DEFAULT_MAX_QTY): number {
  const value = Math.trunc(quantity);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(value, Math.max(1, max));
}

function isDuplicateCartError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "23505" || message.includes("duplicate") || message.includes("cart_items_user_book_unique");
}

export function normalizeCartItem(row: unknown): CartItemRow | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  if (typeof value.id !== "string" || typeof value.user_id !== "string" || typeof value.book_id !== "string") return null;

  return {
    id: value.id,
    user_id: value.user_id,
    book_id: value.book_id,
    quantity: Math.max(1, toInt(value.quantity, 1)),
    created_at: typeof value.created_at === "string" ? value.created_at : undefined,
    updated_at: typeof value.updated_at === "string" ? value.updated_at : undefined,
  };
}

function createUnavailableBook(bookId: string): CartBook {
  return {
    id: bookId,
    slug: bookId,
    title: "Книга временно недоступна",
    authors: ["—"],
    genres: [],
    description: "Эта книга скрыта из каталога или была удалена. Удалите позицию из корзины.",
    price: 0,
    format: "Печатная",
    coverUrl: "",
    rating: 0,
    reviewsCount: 0,
    isActive: false,
    inStock: 0,
    topics: [],
    ai: {
      summary: "—",
      topics: [],
      keywords: [],
      complexityLevel: "Средний",
      emotionalTone: "—",
      status: "В очереди",
      updatedAt: "—",
    },
  };
}

function toCartItem(row: CartItemRow, book?: CartBook): CartItem {
  const cartBook = book ?? createUnavailableBook(row.book_id);
  const stockQty = Math.max(0, cartBook.inStock ?? 0);
  const isActive = Boolean(cartBook.isActive);
  const hasStock = stockQty > 0;
  const quantityFitsStock = !hasStock ? false : row.quantity <= stockQty;
  const isAvailable = isActive && hasStock && quantityFitsStock;

  let availabilityMessage: string | undefined;
  if (!isActive) availabilityMessage = "Эта книга временно недоступна";
  else if (!hasStock) availabilityMessage = "Нет в наличии";
  else if (!quantityFitsStock) availabilityMessage = `В наличии только ${stockQty}`;

  const unitPrice = Number.isFinite(cartBook.price) ? cartBook.price : 0;
  const quantity = Math.max(1, row.quantity);

  return {
    id: row.id,
    bookId: row.book_id,
    quantity,
    qty: quantity,
    book: cartBook,
    unitPrice,
    lineTotal: unitPrice * quantity,
    isAvailable,
    availabilityMessage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchCartRows(userId: string): Promise<CartItemRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select("id, user_id, book_id, quantity, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw createServiceError("Не удалось загрузить корзину", error);
  }

  return (data ?? [])
    .map(normalizeCartItem)
    .filter((row): row is CartItemRow => row !== null);
}

async function fetchBooksByIds(bookIds: string[]): Promise<Map<string, CartBook>> {
  const result = new Map<string, CartBook>();
  if (!bookIds.length) return result;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("book_catalog_view")
    .select("*")
    .in("id", bookIds);

  if (error) {
    throw createServiceError("Не удалось загрузить книги корзины", error);
  }

  ((data ?? []) as CatalogViewRow[])
    .map(mapCatalogRowToBook)
    .forEach((book) => result.set(book.id, book));

  return result;
}

async function getActiveBookForCart(bookId: string): Promise<CartBook> {
  const books = await fetchBooksByIds([bookId]);
  const book = books.get(bookId);

  if (!book || !book.isActive) {
    throw createServiceError("Эта книга временно недоступна");
  }

  if ((book.inStock ?? 0) <= 0) {
    throw createServiceError("Этой книги сейчас нет в наличии");
  }

  return book;
}

export function calculateCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.lineTotal, 0);
}

export async function getCartItems(): Promise<CartItem[]> {
  const userId = await getCurrentUserId();
  const rows = await fetchCartRows(userId);
  const booksById = await fetchBooksByIds(rows.map((row) => row.book_id));
  return rows.map((row) => toCartItem(row, booksById.get(row.book_id)));
}

export async function getCart(): Promise<CartStateSnapshot> {
  const items = await getCartItems();
  return {
    items,
    count: getCartItemCount(items),
    total: calculateCartTotal(items),
  };
}

export function getCartItemCount(items: CartItem[]): number {
  return items.reduce((count, item) => count + item.quantity, 0);
}

export async function getCartCount(): Promise<number> {
  const items = await getCartItems();
  return getCartItemCount(items);
}

export async function addToCart(bookId: string, quantity = 1): Promise<CartItem> {
  if (!bookId) {
    throw createServiceError("Не удалось определить книгу для корзины");
  }

  const userId = await getCurrentUserId();
  const book = await getActiveBookForCart(bookId);
  const requestedQty = clampQuantity(quantity, book.inStock || DEFAULT_MAX_QTY);
  const supabase = getSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("cart_items")
    .select("id, user_id, book_id, quantity, created_at, updated_at")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .maybeSingle();

  if (existingError) {
    throw createServiceError("Не удалось проверить корзину", existingError);
  }

  if (existing) {
    const row = normalizeCartItem(existing);
    if (!row) throw createServiceError("Supabase вернул некорректную позицию корзины");
    const nextQty = clampQuantity(row.quantity + requestedQty, book.inStock || DEFAULT_MAX_QTY);
    return updateCartItemQuantity(row.id, nextQty);
  }

  const payload = { user_id: userId, book_id: bookId, quantity: requestedQty };
  const { data, error } = await supabase
    .from("cart_items")
    .insert(payload)
    .select("id, user_id, book_id, quantity, created_at, updated_at")
    .single();

  if (error) {
    if (isDuplicateCartError(error)) {
      return updateCartBookQuantity(bookId, requestedQty + 1);
    }
    throw createServiceError("Не удалось добавить книгу в корзину", error);
  }

  const row = normalizeCartItem(data);
  if (!row) throw createServiceError("Supabase вернул некорректную позицию корзины");
  return toCartItem(row, book);
}

export async function updateCartItemQuantity(itemId: string, quantity: number): Promise<CartItem> {
  if (!itemId) throw createServiceError("Не удалось определить позицию корзины");

  const userId = await getCurrentUserId();
  const supabase = getSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("cart_items")
    .select("id, user_id, book_id, quantity, created_at, updated_at")
    .eq("user_id", userId)
    .eq("id", itemId)
    .maybeSingle();

  if (existingError) throw createServiceError("Не удалось проверить позицию корзины", existingError);
  const row = normalizeCartItem(existing);
  if (!row) throw createServiceError("Позиция корзины не найдена");

  const book = await getActiveBookForCart(row.book_id);
  const nextQty = clampQuantity(quantity, book.inStock || DEFAULT_MAX_QTY);

  const { data, error } = await supabase
    .from("cart_items")
    .update({ quantity: nextQty })
    .eq("user_id", userId)
    .eq("id", itemId)
    .select("id, user_id, book_id, quantity, created_at, updated_at")
    .single();

  if (error) throw createServiceError("Не удалось обновить количество", error);

  const updatedRow = normalizeCartItem(data);
  if (!updatedRow) throw createServiceError("Supabase вернул некорректную позицию корзины");
  return toCartItem(updatedRow, book);
}

export async function updateCartBookQuantity(bookId: string, quantity: number): Promise<CartItem> {
  if (!bookId) throw createServiceError("Не удалось определить книгу в корзине");

  const userId = await getCurrentUserId();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select("id")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .maybeSingle();

  if (error) throw createServiceError("Не удалось найти позицию корзины", error);
  const itemId = typeof data?.id === "string" ? data.id : null;
  if (!itemId) throw createServiceError("Позиция корзины не найдена");

  return updateCartItemQuantity(itemId, quantity);
}

export async function removeCartItem(itemId: string): Promise<void> {
  if (!itemId) throw createServiceError("Не удалось определить позицию корзины");

  const userId = await getCurrentUserId();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", userId)
    .eq("id", itemId);

  if (error) throw createServiceError("Не удалось удалить книгу из корзины", error);
}

export async function removeCartBook(bookId: string): Promise<void> {
  if (!bookId) throw createServiceError("Не удалось определить книгу в корзине");

  const userId = await getCurrentUserId();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", userId)
    .eq("book_id", bookId);

  if (error) throw createServiceError("Не удалось удалить книгу из корзины", error);
}

export async function clearCart(): Promise<void> {
  const userId = await getCurrentUserId();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", userId);

  if (error) throw createServiceError("Не удалось очистить корзину", error);
}
