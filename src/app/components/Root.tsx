import { createContext, useContext, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Toaster, toast } from "sonner";
import { Header } from "./Header";
import { useAuth } from "../auth/AuthContext";
import { Footer } from "./Footer";
import { DEMO_ORDERS } from "./data";
import { getCachedBookById } from "../../services/catalogService";
import type { CartItem, Order, Preferences, User } from "./types";

interface AppContextValue {
  user: User | null;
  favorites: string[];
  toggleFav: (id: string) => void;
  cart: CartItem[];
  addToCart: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  preferences: Preferences | null;
  setPreferences: (p: Preferences) => void;
  orders: Order[];
  setOrders: (orders: Order[] | ((prev: Order[]) => Order[])) => void;
  aiAvailable: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within Root");
  return ctx;
};

export function Root() {
  const [favorites, setFavorites] = useState<string[]>([]);
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

  const toggleFav = (id: string) => {
    const was = favorites.includes(id);
    setFavorites((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    );
    if (!was) toast.success("Добавлено в избранное");
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
