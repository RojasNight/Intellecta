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

export interface CartItem {
  bookId: string;
  qty: number;
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
