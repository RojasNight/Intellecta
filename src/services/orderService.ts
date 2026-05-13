import { getSupabaseClient } from "../lib/supabase";
import type {
  OrderContact,
  OrderItemRow,
  OrderRow,
  OrderStatus,
  OrderWithItems,
} from "../app/components/types";

export type DeliveryType = "pickup" | "courier" | "digital";

export type CreateOrderInput = {
  deliveryType: DeliveryType;
  contact: OrderContact;
  comment?: string;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

type OrderDbRow = {
  id: string;
  user_id: string;
  status: string;
  total_amount: number | string;
  delivery_type: string;
  contact_json: unknown;
  comment: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type OrderItemDbRow = {
  id: string;
  order_id: string;
  book_id: string | null;
  title_snapshot: string;
  price_snapshot: number | string;
  quantity: number | string;
  created_at?: string | null;
};

const ORDER_STATUSES: OrderStatus[] = ["created", "processing", "completed", "cancelled"];
const DELIVERY_TYPES: DeliveryType[] = ["pickup", "courier", "digital"];

function debugError(source: string, error: unknown) {
  if (!import.meta.env.DEV) return;
  const value = error as SupabaseErrorLike | null;
  console.error(`[Интеллекта][orders] ${source}`, {
    code: value?.code,
    message: value?.message ?? (error instanceof Error ? error.message : String(error ?? "")),
    details: value?.details,
    hint: value?.hint,
  });
}

function getOrderErrorMessage(error: unknown, fallback: string) {
  const value = error as SupabaseErrorLike | null;
  const raw = value?.message ?? (error instanceof Error ? error.message : String(error ?? ""));
  const message = raw.toLowerCase();

  if (message.includes("корзина пуста")) return "Корзина пуста. Добавьте книги перед оформлением заказа.";
  if (message.includes("требуется авторизация")) return "Войдите, чтобы оформить заказ.";
  if (message.includes("недоступные книги")) return "В корзине есть недоступные книги. Вернитесь в корзину и удалите их.";
  if (message.includes("превышает доступный остаток")) return "Количество одной или нескольких книг превышает доступный остаток.";
  if (message.includes("выберите корректный способ")) return "Выберите корректный способ получения заказа.";
  if (message.includes("недостаточно прав")) return "Недостаточно прав для этого действия.";
  if (message.includes("заказ не найден")) return "Заказ не найден или недоступен.";
  if (message.includes("row-level security") || message.includes("violates row-level security")) return "Операция заблокирована политиками безопасности Supabase.";
  if (message.includes("failed to fetch") || message.includes("network")) return "Не удалось подключиться к Supabase. Проверьте сеть и переменные окружения.";

  return fallback;
}

function createServiceError(fallback: string, cause?: unknown) {
  debugError(fallback, cause);
  return new Error(getOrderErrorMessage(cause, fallback));
}

async function getCurrentUserId(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) throw createServiceError("Не удалось проверить текущего пользователя", error);
  if (!data.user?.id) throw createServiceError("Войдите, чтобы оформить заказ");

  return data.user.id;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toInt(value: unknown, fallback = 0): number {
  return Math.trunc(toNumber(value, fallback));
}

function asOrderStatus(value: unknown): OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus) ? value as OrderStatus : "created";
}

function asDeliveryType(value: unknown): DeliveryType {
  return DELIVERY_TYPES.includes(value as DeliveryType) ? value as DeliveryType : "pickup";
}

function normalizeContact(value: unknown): OrderContact {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { name: "", email: "", phone: "", address: "" };
  }

  const record = value as Record<string, unknown>;
  return {
    name: typeof record.name === "string" ? record.name : "",
    email: typeof record.email === "string" ? record.email : "",
    phone: typeof record.phone === "string" ? record.phone : "",
    address: typeof record.address === "string" ? record.address : "",
  };
}

export function normalizeOrderRow(row: unknown): OrderRow | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Partial<OrderDbRow>;
  if (typeof value.id !== "string" || typeof value.user_id !== "string") return null;

  return {
    id: value.id,
    user_id: value.user_id,
    status: asOrderStatus(value.status),
    total_amount: toNumber(value.total_amount),
    delivery_type: asDeliveryType(value.delivery_type),
    contact_json: normalizeContact(value.contact_json),
    comment: typeof value.comment === "string" ? value.comment : null,
    created_at: typeof value.created_at === "string" ? value.created_at : null,
    updated_at: typeof value.updated_at === "string" ? value.updated_at : null,
  };
}

export function normalizeOrderItemRow(row: unknown): OrderItemRow | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Partial<OrderItemDbRow>;
  if (typeof value.id !== "string" || typeof value.order_id !== "string") return null;

  return {
    id: value.id,
    order_id: value.order_id,
    book_id: typeof value.book_id === "string" ? value.book_id : null,
    title_snapshot: typeof value.title_snapshot === "string" ? value.title_snapshot : "Книга",
    price_snapshot: toNumber(value.price_snapshot),
    quantity: Math.max(1, toInt(value.quantity, 1)),
    created_at: typeof value.created_at === "string" ? value.created_at : null,
  };
}

function groupOrdersWithItems(orders: OrderRow[], items: OrderItemRow[]): OrderWithItems[] {
  const byOrderId = new Map<string, OrderItemRow[]>();
  items.forEach((item) => {
    byOrderId.set(item.order_id, [...(byOrderId.get(item.order_id) ?? []), item]);
  });

  return orders.map((order) => ({
    ...order,
    items: byOrderId.get(order.id) ?? [],
  }));
}

async function fetchOrderItems(orderIds: string[]): Promise<OrderItemRow[]> {
  if (orderIds.length === 0) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("id, order_id, book_id, title_snapshot, price_snapshot, quantity, created_at")
    .in("order_id", orderIds)
    .order("created_at", { ascending: true });

  if (error) throw createServiceError("Не удалось загрузить состав заказов", error);

  return (data ?? [])
    .map(normalizeOrderItemRow)
    .filter((item): item is OrderItemRow => item !== null);
}

async function fetchOrdersForCurrentRlsScope(): Promise<OrderWithItems[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, user_id, status, total_amount, delivery_type, contact_json, comment, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) throw createServiceError("Не удалось загрузить заказы", error);

  const orders = (data ?? [])
    .map(normalizeOrderRow)
    .filter((order): order is OrderRow => order !== null);

  const items = await fetchOrderItems(orders.map((order) => order.id));
  return groupOrdersWithItems(orders, items);
}

export async function createOrderFromCart(
  deliveryType: DeliveryType,
  contact: OrderContact,
  comment = "",
): Promise<OrderWithItems> {
  await getCurrentUserId();
  if (!DELIVERY_TYPES.includes(deliveryType)) {
    throw new Error("Выберите корректный способ получения заказа.");
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("create_order_from_cart", {
    p_delivery_type: deliveryType,
    p_contact_json: contact,
    p_comment: comment.trim() || null,
  });

  if (error) throw createServiceError("Не удалось оформить заказ", error);

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const order = normalizeOrderRow(rows[0]);
  if (!order) throw createServiceError("Supabase вернул некорректные данные заказа");

  const items = await fetchOrderItems([order.id]);
  return { ...order, items };
}

export async function getMyOrders(): Promise<OrderWithItems[]> {
  await getCurrentUserId();
  return fetchOrdersForCurrentRlsScope();
}

export async function getOrderDetails(orderId: string): Promise<OrderWithItems | null> {
  await getCurrentUserId();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, user_id, status, total_amount, delivery_type, contact_json, comment, created_at, updated_at")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw createServiceError("Не удалось загрузить заказ", error);
  const order = normalizeOrderRow(data);
  if (!order) return null;

  const items = await fetchOrderItems([order.id]);
  return { ...order, items };
}

export async function adminGetOrders(): Promise<OrderWithItems[]> {
  await getCurrentUserId();
  return fetchOrdersForCurrentRlsScope();
}

export async function adminUpdateOrderStatus(orderId: string, status: OrderStatus): Promise<OrderWithItems> {
  await getCurrentUserId();
  if (!ORDER_STATUSES.includes(status)) throw new Error("Некорректный статус заказа.");

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_update_order_status", {
    p_order_id: orderId,
    p_status: status,
  });

  if (error) throw createServiceError("Не удалось изменить статус заказа", error);

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const order = normalizeOrderRow(rows[0]);
  if (!order) throw createServiceError("Supabase вернул некорректные данные заказа");

  const items = await fetchOrderItems([order.id]);
  return { ...order, items };
}
