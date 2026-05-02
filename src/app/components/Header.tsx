import { Heart, Menu, ShoppingCart, User2, X, BookOpen } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { BRAND } from "./brand";

interface Props {
  cartCount: number;
  favCount: number;
  isAuthed: boolean;
  isAdmin: boolean;
  onLogout: () => void;
}

export function Header({ cartCount, favCount, isAuthed, isAdmin, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: { label: string; path: string }[] = [
    { label: "Каталог", path: "/catalog" },
    { label: "Рекомендации", path: "/recommendations" },
    { label: "Избранное", path: "/favorites" },
  ];

  const linkClass = (path: string) =>
    `transition-colors hover:opacity-80 ${
      location.pathname === path ? "border-b-2" : "border-b-2 border-transparent"
    } pb-1`;

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{ background: BRAND.cream, borderColor: BRAND.beige }}
    >
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2"
          style={{ color: BRAND.navy }}
          aria-label="ИНТЕЛЛЕКТА — на главную"
        >
          <BookOpen size={22} />
          <span
            className="font-serif tracking-[0.18em]"
            style={{ fontSize: 18, fontWeight: 600 }}
          >
            ИНТЕЛЛЕКТА
          </span>
        </button>

        <nav className="hidden md:flex items-center gap-7" style={{ color: BRAND.navy }}>
          {navItems.map((it) => (
            <button
              key={it.path}
              onClick={() => navigate(it.path)}
              className={linkClass(it.path)}
              style={{ borderColor: location.pathname === it.path ? BRAND.navy : "transparent" }}
            >
              {it.label}
            </button>
          ))}
          {isAdmin && (
            <button onClick={() => navigate("/admin")} className={linkClass("admin")}
              style={{ borderColor: location.pathname === "/admin" ? BRAND.navy : "transparent" }}>
              Админка
            </button>
          )}
        </nav>

        <div className="flex items-center gap-2 md:gap-4" style={{ color: BRAND.navy }}>
          <button
            onClick={() => navigate("/favorites")}
            className="relative p-2 hidden sm:inline-flex"
            aria-label="Избранное"
          >
            <Heart size={20} />
            {favCount > 0 && <Badge n={favCount} />}
          </button>
          <button
            onClick={() => navigate("/cart")}
            className="relative p-2"
            aria-label="Корзина"
          >
            <ShoppingCart size={20} />
            {cartCount > 0 && <Badge n={cartCount} />}
          </button>
          {isAuthed ? (
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => navigate("/preferences")}
                className="p-2"
                aria-label="Профиль"
              >
                <User2 size={20} />
              </button>
              <button
                onClick={onLogout}
                className="text-sm hidden lg:inline-block"
                style={{ color: BRAND.slate }}
              >
                Выйти
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ background: BRAND.navy, color: "white" }}
            >
              Войти
            </button>
          )}
          <button
            className="md:hidden p-2"
            onClick={() => setOpen(true)}
            aria-label="Меню"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-[80%] max-w-sm p-6 flex flex-col gap-4"
            style={{ background: BRAND.cream }}
          >
            <div className="flex items-center justify-between">
              <span className="font-serif tracking-[0.18em]" style={{ color: BRAND.navy, fontSize: 16 }}>
                ИНТЕЛЛЕКТА
              </span>
              <button onClick={() => setOpen(false)} aria-label="Закрыть меню">
                <X size={22} />
              </button>
            </div>
            {[
              { label: "Главная", path: "/" },
              ...navItems,
              { label: "Корзина", path: "/cart" },
              ...(isAuthed
                ? [
                    { label: "Мои заказы", path: "/orders" },
                    { label: "Предпочтения", path: "/preferences" },
                  ]
                : [
                    { label: "Войти", path: "/login" },
                    { label: "Регистрация", path: "/register" },
                  ]),
              ...(isAdmin ? [{ label: "Админка", path: "/admin" }] : []),
            ].map((it) => (
              <button
                key={it.label}
                onClick={() => {
                  setOpen(false);
                  navigate(it.path);
                }}
                className="text-left py-2 border-b"
                style={{ color: BRAND.navy, borderColor: BRAND.beige }}
              >
                {it.label}
              </button>
            ))}
            {isAuthed && (
              <button
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="text-left py-2"
                style={{ color: BRAND.slate }}
              >
                Выйти
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span
      className="absolute -top-0.5 -right-0.5 rounded-full text-white"
      style={{
        background: BRAND.navy,
        fontSize: 10,
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {n}
    </span>
  );
}
