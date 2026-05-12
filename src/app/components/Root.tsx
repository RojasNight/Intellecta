import { createContext, useContext, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Toaster, toast } from "sonner";
import { Header } from "./Header";
import { useAuth } from "../auth/AuthContext";
import { Footer } from "./Footer";
import { DEMO_ORDERS } from "./data";
import { getCachedBookById } from "../../services/catalogService";
import { addFavorite, getFavoriteBookIds, removeFavorite } from "../../services/favoritesService";
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
  addToCart: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
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

    void load();
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

  const addToCart = (id: string) => {
    const b = getCachedBookById(id);
    if (b && (!b.isActive || b.inStock <= 0)) {
      toast.error("Книга временно недоступна");
      return;
    }
    setCart((s) => {
      const ex = s.find((x) => x.bookId === id);
      if (ex) return s.map((x) => x.bookId === id ? { ...x, qty: x.qty + 1 } : x);
      return [...s, { bookId: id, qty: 1 }];
    });
    toast.success("Добавлено в корзину");
  };

  const setQty = (id: string, qty: number) =>
    setCart((s) => s.map((x) => x.bookId === id ? { ...x, qty } : x));

  const removeItem = (id: string) =>
    setCart((s) => s.filter((x) => x.bookId !== id));

  const clearCart = () => setCart([]);

  const cartCount = cart.reduce((n, x) => n + x.qty, 0);

  const contextValue: AppContextValue = {
    user,
    favorites,
    favoriteLoading,
    favoriteError,
    favoritePendingIds,
    reloadFavorites,
    toggleFav,
    cart,
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
