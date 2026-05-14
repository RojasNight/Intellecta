export type Format = "Печатная" | "Электронная" | "Аудио";
export type Complexity = "Лёгкий" | "Средний" | "Сложный" | "Профессиональный";

export interface BookAIProfile {
  summary: string;
  topics: string[];
  keywords: string[];
  complexityLevel: Complexity;
  emotionalTone: string;
  status: "В очереди" | "Выполняется" | "Готово" | "Ошибка";
  updatedAt: string;
}

export interface Book {
  id: string;
  slug: string;
  title: string;
  authors: string[];
  genres: string[];
  description: string;
  price: number;
  format: Format;
  coverUrl: string;
  rating: number;
  reviewsCount: number;
  isActive: boolean;
  inStock: number;
  topics: string[];
  ai: BookAIProfile;
}



export type AIJobStatus = "running" | "ready" | "failed";
export type BookAIProfileStatusValue = "stale" | "running" | "ready" | "failed";

export interface AIJobRow {
  id: string;
  book_id: string;
  status: AIJobStatus;
  started_at?: string;
  finished_at?: string;
  error_message?: string;
  created_at?: string;
}

export interface BookAIProfileAnalysis {
  book_id: string;
  summary: string;
  topics: string[];
  keywords: string[];
  complexity_level: number;
  emotional_tone: string;
  updated_at?: string;
  status?: BookAIProfileStatusValue;
}

export interface FavoriteRow {
  user_id: string;
  book_id: string;
  created_at?: string;
}

export interface FavoriteBook extends Book {}

export interface FavoriteState {
  favoriteBookIds: string[];
  favoriteBooks: FavoriteBook[];
  loading: boolean;
  error: string | null;
}

export interface AddFavoriteInput {
  bookId: string;
}

export interface RemoveFavoriteInput {
  bookId: string;
}

export interface CartItemRow {
  id: string;
  user_id: string;
  book_id: string;
  quantity: number;
  created_at?: string;
  updated_at?: string;
}

export interface CartBook extends Book {
  stockQty?: number;
}

export interface CartItem {
  id: string;
  bookId: string;
  quantity: number;
  /** Legacy alias kept while UI components migrate from local cart state. */
  qty: number;
  book: CartBook;
  unitPrice: number;
  lineTotal: number;
  isAvailable: boolean;
  availabilityMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartState {
  items: CartItem[];
  count: number;
  total: number;
  loading: boolean;
  error: string | null;
}

export interface AddToCartInput {
  bookId: string;
  quantity?: number;
}

export interface UpdateCartQuantityInput {
  itemId?: string;
  bookId?: string;
  quantity: number;
}

export interface RecommendationItem {
  bookId: string;
  score: number;
  reasons: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
}

export interface Preferences {
  genres: string[];
  topics: string[];
  goals: string[];
  complexityMin: number;
  complexityMax: number;
  excludedGenres: string[];
}

export interface UserPreferences extends Preferences {
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserPreferencesRow {
  user_id: string;
  genres: unknown;
  topics: unknown;
  goals: unknown;
  complexity_min: number | null;
  complexity_max: number | null;
  excluded_genres: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UpdateUserPreferencesInput extends Preferences {}

export type DeliveryType = "pickup" | "courier" | "digital";
export type OrderStatus = "created" | "processing" | "completed" | "cancelled";

export interface OrderContact {
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

export interface OrderRow {
  id: string;
  user_id: string;
  status: OrderStatus;
  total_amount: number;
  delivery_type: DeliveryType;
  contact_json: OrderContact;
  comment?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  book_id: string | null;
  title_snapshot: string;
  price_snapshot: number;
  quantity: number;
  created_at?: string | null;
}

export interface OrderWithItems extends OrderRow {
  items: OrderItemRow[];
}

export interface OrderState {
  orders: OrderRow[];
  items: OrderItemRow[];
  loading: boolean;
  error: string | null;
}

/** Legacy shape kept for older demo data that is not used by Stage 16 order pages. */
export interface Order {
  id: string;
  status: "создан" | "в обработке" | "завершен" | "отменен";
  total: number;
  contact: { name: string; email: string; phone: string };
  deliveryType: string;
  items: { bookId: string; title: string; qty: number; price: number }[];
  createdAt: string;
}

export type ViewName =
  | "home"
  | "catalog"
  | "book"
  | "search"
  | "login"
  | "register"
  | "preferences"
  | "recommendations"
  | "favorites"
  | "cart"
  | "checkout"
  | "orders"
  | "admin"
  | "error-401"
  | "error-403"
  | "error-404";
