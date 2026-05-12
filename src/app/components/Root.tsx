import { createContext, useContext, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Toaster, toast } from "sonner";
import { Header } from "./Header";
import { useAuth } from "../auth/AuthContext";
import { Footer } from "./Footer";
import { DEMO_ORDERS } from "./data";
import { addFavorite, getFavoriteBookIds, removeFavorite } from "../../services/favoritesService";
import {
  addToCart as addCartItem,
  clearCart as clearSupabaseCart,
  getCartItems,
  removeCartBook,
  updateCartBookQuantity,
} from "../../services/cartService";
import type { CartItem, Order, Preferences, User } from "./types";

interface AppContextValue {
  user: User | null;
  favorites: string[];
  favoriteLoading: boolean;
  favoriteError: string | null;
  favoritePendingIds: string[];
  reloadFavorites: () => Promise<void>;
  toggleFav: (id: string) => Promise<void>;
  cart: CartItem[];
  cartLoading: boolean;
  cartError: string | null;
  cartPendingBookIds: string[];
  reloadCart: () => Promise<void>;
  addToCart: (id: string, quantity?: number) => Promise<void>;
  setQty: (id: string, qty: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearCart: () => Promise<void>;
  preferences: Preferences | null;
  setPreferences: (p: Preferences | null) => void;
  orders: Order[];
  setOrders: (orders: Order[] | ((prev: Order[]) => Order[])) => void;
  aiAvailable: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within Root");
  return ctx;
};

export function Root() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [favoritePendingIds, setFavoritePendingIds] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [cartPendingBookIds, setCartPendingBookIds] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [orders, setOrders] = useState<Order[]>(DEMO_ORDERS);
  const [aiAvailable] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAuthenticated, isAdmin, signOut } = useAuth();

  const user: User | null = profile
    ? { id: profile.id, name: profile.name, email: profile.email, role: profile.role }
    : null;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    setPreferences(null);
    setFavorites([]);
    setFavoriteError(null);
    setFavoritePendingIds([]);
    setCart([]);
    setCartError(null);
    setCartPendingBookIds([]);
  }, [profile?.id]);

  const reloadFavorites = async () => {
    if (!isAuthenticated || !profile?.id) {
      setFavorites([]);
      setFavoriteError(null);
      return;
    }

    setFavoriteLoading(true);
    setFavoriteError(null);
    try {
      const ids = await getFavoriteBookIds();
      setFavorites(ids);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось загрузить избранное";
      setFavoriteError(message);
      setFavorites([]);
      if (import.meta.env.DEV) {
        console.error("[Интеллекта][favorites] load:error", { message });
      }
    } finally {
      setFavoriteLoading(false);
    }
  };

  const reloadCart = async () => {
    if (!isAuthenticated || !profile?.id) {
      setCart([]);
      setCartError(null);
      setCartLoading(false);
      return;
    }

    setCartLoading(true);
    setCartError(null);
    try {
      const items = await getCartItems();
      setCart(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось загрузить корзину";
      setCart([]);
      setCartError(message);
      if (import.meta.env.DEV) {
        console.error("[Интеллекта][cart] load:error", { message });
      }
    } finally {
      setCartLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadFavorites() {
      if (!isAuthenticated || !profile?.id) {
        if (!cancelled) {
          setFavorites([]);
          setFavoriteError(null);
          setFavoriteLoading(false);
        }
        return;
      }

      setFavoriteLoading(true);
      setFavoriteError(null);
      try {
        const ids = await getFavoriteBookIds();
        if (!cancelled) setFavorites(ids);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Не удалось загрузить избранное";
        if (!cancelled) {
          setFavorites([]);
          setFavoriteError(message);
        }
        if (import.meta.env.DEV) {
          console.error("[Интеллекта][favorites] auth-load:error", { message });
        }
      } finally {
        if (!cancelled) setFavoriteLoading(false);
      }
    }

    void loadFavorites();
    return () => { cancelled = true; };
  }, [isAuthenticated, profile?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadCart() {
      if (!isAuthenticated || !profile?.id) {
        if (!cancelled) {
          setCart([]);
          setCartError(null);
          setCartLoading(false);
        }
        return;
      }

      setCartLoading(true);
      setCartError(null);
      try {
        const items = await getCartItems();
        if (!cancelled) setCart(items);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Не удалось загрузить корзину";
        if (!cancelled) {
          setCart([]);
          setCartError(message);
        }
        if (import.meta.env.DEV) {
          console.error("[Интеллекта][cart] auth-load:error", { message });
        }
      } finally {
        if (!cancelled) setCartLoading(false);
      }
    }

    void loadCart();
    return () => { cancelled = true; };
  }, [isAuthenticated, profile?.id]);

  const toggleFav = async (id: string) => {
    if (!isAuthenticated || !profile?.id) {
      toast.error("Войдите, чтобы добавлять книги в избранное");
      navigate("/login", { state: { from: location } });
      return;
    }

    if (!UUID_RE.test(id)) {
      toast.error("Избранное доступно только для книг из каталога Supabase");
      return;
    }

    if (favoritePendingIds.includes(id)) return;

    const wasFavorite = favorites.includes(id);
    setFavoritePendingIds((ids) => [...ids, id]);
    setFavoriteError(null);
    setFavorites((ids) => wasFavorite ? ids.filter((value) => value !== id) : [...ids, id]);

    try {
      if (wasFavorite) {
        await removeFavorite(id);
        toast.success("Книга удалена из избранного");
      } else {
        await addFavorite(id);
        toast.success("Книга добавлена в избранное");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось обновить избранное";
      setFavorites((ids) => wasFavorite ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((value) => value !== id));
      setFavoriteError(message);
      toast.error(message);
    } finally {
      setFavoritePendingIds((ids) => ids.filter((value) => value !== id));
    }
  };

  const addToCart = async (id: string, quantity = 1) => {
    if (!isAuthenticated || !profile?.id) {
      toast.error("Войдите, чтобы добавить книгу в корзину");
      navigate("/login", { state: { from: location } });
      return;
    }

    if (!UUID_RE.test(id)) {
      toast.error("Корзина доступна только для книг из каталога Supabase");
      return;
    }

    if (cartPendingBookIds.includes(id)) return;

    setCartPendingBookIds((ids) => [...ids, id]);
    setCartError(null);

    try {
      await addCartItem(id, quantity);
      await reloadCart();
      toast.success("Книга добавлена в корзину");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось обновить корзину";
      setCartError(message);
      toast.error(message);
    } finally {
      setCartPendingBookIds((ids) => ids.filter((value) => value !== id));
    }
  };

  const setQty = async (id: string, qty: number) => {
    if (!isAuthenticated || !profile?.id) {
      toast.error("Войдите, чтобы изменить корзину");
      navigate("/login", { state: { from: location } });
      return;
    }

    const current = cart.find((item) => item.bookId === id);
    if (!current) return;

    const nextQty = Math.max(1, Math.trunc(qty));
    const previousCart = cart;
    setCart((items) => items.map((item) => item.bookId === id
      ? { ...item, quantity: nextQty, qty: nextQty, lineTotal: item.unitPrice * nextQty }
      : item));
    setCartPendingBookIds((ids) => [...ids, id]);
    setCartError(null);

    try {
      await updateCartBookQuantity(id, nextQty);
      await reloadCart();
      toast.success("Количество обновлено");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось обновить количество";
      setCart(previousCart);
      setCartError(message);
      toast.error(message);
    } finally {
      setCartPendingBookIds((ids) => ids.filter((value) => value !== id));
    }
  };

  const removeItem = async (id: string) => {
    if (!isAuthenticated || !profile?.id) {
      toast.error("Войдите, чтобы изменить корзину");
      navigate("/login", { state: { from: location } });
      return;
    }

    const previousCart = cart;
    setCart((items) => items.filter((item) => item.bookId !== id));
    setCartPendingBookIds((ids) => [...ids, id]);
    setCartError(null);

    try {
      await removeCartBook(id);
      toast.success("Книга удалена из корзины");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось удалить книгу из корзины";
      setCart(previousCart);
      setCartError(message);
      toast.error(message);
    } finally {
      setCartPendingBookIds((ids) => ids.filter((value) => value !== id));
    }
  };

  const clearCart = async () => {
    if (!isAuthenticated || !profile?.id) {
      setCart([]);
      return;
    }

    const previousCart = cart;
    setCart([]);
    setCartError(null);
    setCartPendingBookIds(previousCart.map((item) => item.bookId));

    try {
      await clearSupabaseCart();
      toast.success("Корзина очищена");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось очистить корзину";
      setCart(previousCart);
      setCartError(message);
      toast.error(message);
    } finally {
      setCartPendingBookIds([]);
    }
  };

  const cartCount = cart.reduce((n, item) => n + item.quantity, 0);

  const contextValue: AppContextValue = {
    user,
    favorites,
    favoriteLoading,
    favoriteError,
    favoritePendingIds,
    reloadFavorites,
    toggleFav,
    cart,
    cartLoading,
    cartError,
    cartPendingBookIds,
    reloadCart,
    addToCart,
    setQty,
    removeItem,
    clearCart,
    preferences,
    setPreferences,
    orders,
    setOrders,
    aiAvailable,
    searchQuery,
    setSearchQuery,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen flex flex-col" style={{ background: "var(--brand-cream)" }}>
        <Header
          cartCount={cartCount}
          favCount={favorites.length}
          isAuthed={isAuthenticated}
          isAdmin={isAdmin}
          accountLabel={profile?.name || profile?.email}
          onLogout={async () => {
            try {
              await signOut();
              setFavorites([]);
              setFavoriteError(null);
              setFavoritePendingIds([]);
              setCart([]);
              setCartError(null);
              setCartPendingBookIds([]);
              navigate("/");
              toast.success("Вы вышли из аккаунта");
            } catch {
              toast.error("Не удалось выйти из аккаунта");
            }
          }}
        />
        <div className="flex-1">
          <Outlet />
        </div>
        <Footer />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "white",
              color: "#1A2B3C",
              border: "1px solid #E8E4DC",
            },
          }}
        />
      </div>
    </AppContext.Provider>
  );
}
