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
