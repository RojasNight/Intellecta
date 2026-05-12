import { Heart, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { BRAND } from "./brand";
import { getFavoriteBooks } from "../../services/favoritesService";
import { useAppContext } from "./Root";
import type { FavoriteBook, Order } from "./types";
import { EmptyState, GhostButton, Notice, PrimaryButton, SectionTitle, SemanticBadge, StatusBadge } from "./shared";

/* ---------- FAVORITES ---------- */

export function FavoritesPage() {
  const navigate = useNavigate();
  const { favorites, favoriteLoading, favoriteError, favoritePendingIds, cartPendingBookIds, toggleFav, addToCart } = useAppContext();
  const [list, setList] = useState<FavoriteBook[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFavoriteBooks() {
      if (favorites.length === 0) {
        setList([]);
        setLoadError(null);
        return;
      }

      setLoadingBooks(true);
      setLoadError(null);
      try {
        const books = await getFavoriteBooks(favorites);
        if (!cancelled) setList(books);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Не удалось загрузить избранное";
        if (!cancelled) {
          setList([]);
          setLoadError(message);
        }
        if (import.meta.env.DEV) {
          console.error("[Интеллекта][favorites-page] load:error", { message });
        }
      } finally {
        if (!cancelled) setLoadingBooks(false);
      }
    }

    void loadFavoriteBooks();
    return () => { cancelled = true; };
  }, [favorites]);

  const loading = favoriteLoading || loadingBooks;
  const error = favoriteError || loadError;

  return (
    <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 md:py-10 fade-in">
      <SectionTitle sub="Книги, к которым вы хотите вернуться позже">Избранное</SectionTitle>

      {error && (
        <div className="mb-5">
          <Notice tone="err" title="Не удалось обновить избранное">
            {error}
          </Notice>
        </div>
      )}

      {loading ? (
        <Notice tone="info">Загружаем избранные книги…</Notice>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Heart size={22} />}
          title="В избранном пока нет книг"
          text="Добавляйте книги, чтобы возвращаться к ним позже. Скрытые или недоступные книги в этом списке не отображаются."
          action={<PrimaryButton onClick={() => navigate("/catalog")}>Перейти в каталог</PrimaryButton>}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {list.map((b) => {
            const pending = favoritePendingIds.includes(b.id);
            const cartPending = cartPendingBookIds.includes(b.id);
            return (
              <div
                key={b.id}
                className="rounded-xl border p-4 flex gap-4 book-card"
                style={{ background: "white", borderColor: BRAND.beige }}
              >
                <button
                  onClick={() => navigate(`/book/${b.slug || b.id}`)}
                  className="shrink-0 rounded-md overflow-hidden"
                  style={{ width: 80, height: 110, background: BRAND.beige }}
                  aria-label={`Открыть «${b.title}»`}
                >
                  <ImageWithFallback src={b.coverUrl} alt={`Обложка книги «${b.title}»`} className="w-full h-full object-cover" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-serif" style={{ color: BRAND.navy, fontSize: 16, lineHeight: 1.3 }}>{b.title}</div>
                  <div style={{ color: BRAND.slate, fontSize: 13 }}>{b.authors.join(", ")}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {b.topics.slice(0, 2).map((t) => <SemanticBadge key={t}>{t}</SemanticBadge>)}
                  </div>
                  <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
                    <span style={{ color: BRAND.charcoal }}>{b.price} ₽</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFav(b.id)}
                        disabled={pending}
                        className="p-2 rounded-full border"
                        style={{
                          borderColor: BRAND.lightGray,
                          color: BRAND.navy,
                          background: "white",
                          cursor: pending ? "not-allowed" : "pointer",
                          opacity: pending ? 0.7 : 1,
                        }}
                        aria-label="Убрать из избранного"
                      >
                        <Heart size={14} fill={BRAND.navy} stroke={BRAND.navy} />
                      </button>
                      <button
                        onClick={() => addToCart(b.id)}
                        disabled={cartPending || b.inStock <= 0 || !b.isActive}
                        className="rounded-md px-3 py-2 inline-flex items-center gap-2 disabled:opacity-60"
                        style={{ background: cartPending || b.inStock <= 0 || !b.isActive ? BRAND.lightGray : BRAND.navy, color: "white", fontSize: 13 }}
                      >
                        <ShoppingBag size={14} /> В корзину
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

/* ---------- CART ---------- */

export function CartPage() {
  const navigate = useNavigate();
  const { cart, cartLoading, cartError, cartPendingBookIds, setQty, removeItem, user, reloadCart } = useAppContext();
  const isAuthed = !!user;
  const [promo, setPromo] = useState("");

  useEffect(() => {
    if (isAuthed) void reloadCart();
  }, [isAuthed]);

  const total = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const hasUnavailable = cart.some((item) => !item.isAvailable);

  if (!isAuthed) {
    return (
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-10 fade-in">
        <SectionTitle>Корзина</SectionTitle>
        <EmptyState
          icon={<ShoppingBag size={22} />}
          title="Войдите, чтобы пользоваться корзиной"
          text="Корзина сохраняется в вашем профиле и будет доступна после входа с любого устройства."
          action={<PrimaryButton onClick={() => navigate("/login")}>Войти</PrimaryButton>}
        />
      </main>
    );
  }

  if (cartLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-10 fade-in">
        <SectionTitle>Корзина</SectionTitle>
        <Notice tone="info">Загружаем вашу корзину из Supabase…</Notice>
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-10 fade-in">
        <SectionTitle>Корзина</SectionTitle>
        {cartError && (
          <div className="mb-4">
            <Notice tone="err" title="Не удалось загрузить корзину">{cartError}</Notice>
          </div>
        )}
        <EmptyState
          icon={<ShoppingBag size={22} />}
          title="Корзина пока пуста"
          text="Добавьте книги из каталога — позиции сохранятся в вашем аккаунте."
          action={<PrimaryButton onClick={() => navigate("/catalog")}>Перейти в каталог</PrimaryButton>}
        />
      </main>
    );
  }

  return (
    <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 md:py-10 fade-in">
      <SectionTitle sub="Позиции сохраняются в Supabase и используют актуальные цены каталога">Корзина</SectionTitle>

      {cartError && (
        <div className="mb-4">
          <Notice tone="err" title="Не удалось обновить корзину">{cartError}</Notice>
        </div>
      )}

      {hasUnavailable && (
        <div className="mb-4">
          <Notice tone="err" title="Часть позиций недоступна">
            Удалите недоступные книги или уменьшите количество, чтобы продолжить оформление на следующем этапе.
          </Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {cart.map((item) => {
            const book = item.book;
            const maxQty = Math.max(1, book.inStock || 1);
            const pending = cartPendingBookIds.includes(item.bookId);
            return (
              <div
                key={item.id}
                className="rounded-xl border p-4 flex flex-col sm:flex-row gap-4"
                style={{ background: "white", borderColor: BRAND.beige }}
              >
                <div className="flex gap-4 flex-1 min-w-0">
                  <div
                    className="shrink-0 rounded-md overflow-hidden"
                    style={{ width: 72, height: 100, background: BRAND.beige }}
                  >
                    <ImageWithFallback src={book.coverUrl} alt={`Обложка книги «${book.title}»`} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => book.isActive && navigate(`/book/${book.slug || book.id}`)}
                      className="font-serif text-left"
                      style={{ color: BRAND.navy, fontSize: 16, lineHeight: 1.3 }}
                    >
                      {book.title}
                    </button>
                    <div style={{ color: BRAND.slate, fontSize: 13 }}>{book.authors.join(", ")}</div>
                    <div style={{ color: BRAND.gray, fontSize: 13, marginTop: 4 }}>
                      {item.unitPrice} ₽ × {item.quantity}
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <StatusBadge
                        status={item.isAvailable ? "Доступно" : item.availabilityMessage ?? "Недоступно"}
                        tone={item.isAvailable ? "ok" : "err"}
                      />
                      {book.inStock > 0 && item.quantity > book.inStock && (
                        <StatusBadge status={`В наличии только ${book.inStock}`} tone="warn" />
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3 shrink-0">
                  <Stepper
                    qty={item.quantity}
                    max={maxQty}
                    disabled={pending || !book.isActive || book.inStock <= 0}
                    onChange={(n) => setQty(item.bookId, Math.max(1, Math.min(maxQty, n)))}
                  />
                  <div className="flex items-center gap-2">
                    <span style={{ color: BRAND.charcoal }}>{item.lineTotal} ₽</span>
                    <button
                      onClick={() => removeItem(item.bookId)}
                      disabled={pending}
                      className="p-2 rounded-md disabled:opacity-50"
                      style={{ color: BRAND.slate }}
                      aria-label={`Удалить «${book.title}» из корзины`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <aside
          className="rounded-xl border p-5 h-fit lg:sticky lg:top-20"
          style={{ background: "white", borderColor: BRAND.beige }}
        >
          <div className="font-serif" style={{ color: BRAND.navy, fontSize: 18, marginBottom: 12 }}>
            Итого
          </div>
          <div className="flex items-center justify-between" style={{ color: BRAND.slate, fontSize: 14 }}>
            <span>Товары ({itemCount})</span><span>{total} ₽</span>
          </div>
          <div className="flex items-center justify-between mt-2" style={{ color: BRAND.slate, fontSize: 14 }}>
            <span>Доставка</span><span>на Stage 16</span>
          </div>
          <div className="mt-4">
            <label htmlFor="promo" style={{ color: BRAND.darkSlate, fontSize: 13 }}>Промокод</label>
            <input
              id="promo" value={promo} onChange={(e) => setPromo(e.target.value)}
              className="w-full rounded-md border px-3 py-2 mt-1 outline-none"
              style={{ borderColor: BRAND.lightGray }} placeholder="ИНТЕЛЛЕКТА10"
            />
          </div>
          <div
            className="flex items-center justify-between mt-5 pt-4 border-t"
            style={{ borderColor: BRAND.beige, color: BRAND.charcoal }}
          >
            <span>К оплате</span><span style={{ fontSize: 20 }}>{total} ₽</span>
          </div>
          <div className="mt-4">
            <PrimaryButton full onClick={() => navigate("/checkout")} disabled={hasUnavailable || cart.length === 0}>
              Продолжить
            </PrimaryButton>
          </div>
          <div style={{ color: BRAND.slate, fontSize: 12, marginTop: 8, textAlign: "center" }}>
            Оформление заказа будет подключено на Stage 16 через RPC.
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stepper({
  qty, onChange, max = 99, disabled = false,
}: { qty: number; onChange: (n: number) => void; max?: number; disabled?: boolean }) {
  return (
    <div
      className="inline-flex items-center rounded-md border"
      style={{ borderColor: BRAND.lightGray, background: "white" }}
      role="group" aria-label="Количество"
    >
      <button onClick={() => onChange(qty - 1)} disabled={disabled || qty <= 1}
        className="p-2 disabled:opacity-40" aria-label="Уменьшить количество">
        <Minus size={14} />
      </button>
      <span className="px-3" style={{ color: BRAND.charcoal, minWidth: 28, textAlign: "center" }}>{qty}</span>
      <button onClick={() => onChange(qty + 1)} disabled={disabled || qty >= max}
        className="p-2 disabled:opacity-40" aria-label="Увеличить количество">
        <Plus size={14} />
      </button>
    </div>
  );
}

/* ---------- CHECKOUT ---------- */

export function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, cartLoading, cartError, user, reloadCart } = useAppContext();
  const total = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const hasUnavailable = cart.some((item) => !item.isAvailable);

  useEffect(() => {
    if (user) void reloadCart();
  }, [user?.id]);

  if (cartLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-10 fade-in">
        <SectionTitle>Оформление заказа</SectionTitle>
        <Notice tone="info">Загружаем актуальную корзину…</Notice>
      </main>
    );
  }

  return (
    <main className="max-w-[900px] mx-auto px-4 md:px-8 py-8 md:py-10 fade-in">
      <SectionTitle sub="Заказ будет создан на следующем этапе через Supabase RPC">Оформление заказа</SectionTitle>

      {cartError && (
        <div className="mb-4"><Notice tone="err" title="Не удалось загрузить корзину">{cartError}</Notice></div>
      )}

      {cart.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={22} />}
          title="Корзина пока пуста"
          text="Добавьте книги перед оформлением заказа."
          action={<PrimaryButton onClick={() => navigate("/catalog")}>Перейти в каталог</PrimaryButton>}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-xl border p-5" style={{ background: "white", borderColor: BRAND.beige }}>
            <h2 className="font-serif" style={{ color: BRAND.navy, fontSize: 20 }}>Состав корзины</h2>
            <div className="mt-4 space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 border-b pb-3" style={{ borderColor: BRAND.beige }}>
                  <div>
                    <div style={{ color: BRAND.navy }}>{item.book.title}</div>
                    <div style={{ color: BRAND.slate, fontSize: 13 }}>{item.quantity} × {item.unitPrice} ₽</div>
                    {!item.isAvailable && (
                      <div className="mt-1"><StatusBadge status={item.availabilityMessage ?? "Недоступно"} tone="err" /></div>
                    )}
                  </div>
                  <div style={{ color: BRAND.charcoal }}>{item.lineTotal} ₽</div>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-xl border p-5 h-fit" style={{ background: "white", borderColor: BRAND.beige }}>
            <div className="font-serif" style={{ color: BRAND.navy, fontSize: 18 }}>Итого</div>
            <div className="flex items-center justify-between mt-4" style={{ color: BRAND.charcoal }}>
              <span>Сумма</span><span style={{ fontSize: 20 }}>{total} ₽</span>
            </div>
            {hasUnavailable && (
              <div className="mt-4">
                <Notice tone="err">Удалите недоступные позиции перед оформлением.</Notice>
              </div>
            )}
            <div className="mt-4">
              <PrimaryButton full disabled>
                Оформление заказа — Stage 16
              </PrimaryButton>
            </div>
            <div className="mt-3">
              <GhostButton full onClick={() => navigate("/cart")}>Вернуться в корзину</GhostButton>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

/* ---------- ORDERS ---------- */

export function OrdersPage() {
  const navigate = useNavigate();
  const { orders, user } = useAppContext();
  const tone = (s: Order["status"]) =>
    s === "завершен" ? "ok" : s === "отменен" ? "err" : s === "в обработке" ? "warn" : "info";

  const userOrders = user ? orders : [];

  return (
    <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 md:py-10 fade-in">
      <SectionTitle sub="История ваших заказов">Мои заказы</SectionTitle>
      {!user ? (
        <EmptyState
          icon={<ShoppingBag size={22} />}
          title="Требуется авторизация"
          text="Войдите в аккаунт, чтобы увидеть историю заказов."
          action={<PrimaryButton onClick={() => navigate("/login")}>Войти</PrimaryButton>}
        />
      ) : userOrders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={22} />}
          title="Заказов пока нет"
          text="Оформите первый заказ — он появится здесь."
          action={<PrimaryButton onClick={() => navigate("/catalog")}>В каталог</PrimaryButton>}
        />
      ) : (
        <>
          <div className="hidden md:block rounded-xl border overflow-hidden" style={{ background: "white", borderColor: BRAND.beige }}>
            <div className="grid grid-cols-[1fr_120px_140px_120px_120px_100px] px-5 py-3 border-b"
              style={{ borderColor: BRAND.beige, color: BRAND.slate, fontSize: 13 }}>
              <div>Заказ</div><div>Дата</div><div>Статус</div><div>Сумма</div><div>Позиций</div><div></div>
            </div>
            {userOrders.map((o) => (
              <div key={o.id}
                className="grid grid-cols-[1fr_120px_140px_120px_120px_100px] px-5 py-4 border-b items-center gap-2"
                style={{ borderColor: BRAND.beige }}>
                <div style={{ color: BRAND.navy }}>{o.id}</div>
                <div style={{ color: BRAND.charcoal }}>{o.createdAt}</div>
                <div><StatusBadge status={o.status} tone={tone(o.status) as "ok" | "warn" | "err" | "info"} /></div>
                <div style={{ color: BRAND.charcoal }}>{o.total} ₽</div>
                <div style={{ color: BRAND.slate }}>{o.items.length}</div>
                <div className="text-right"><button style={{ color: BRAND.navy }}>Подробнее</button></div>
              </div>
            ))}
          </div>

          <div className="md:hidden space-y-3">
            {userOrders.map((o) => (
              <div key={o.id} className="rounded-xl border p-4"
                style={{ background: "white", borderColor: BRAND.beige }}>
                <div className="flex items-center justify-between gap-2">
                  <div style={{ color: BRAND.navy }}>{o.id}</div>
                  <StatusBadge status={o.status} tone={tone(o.status) as "ok" | "warn" | "err" | "info"} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3" style={{ color: BRAND.charcoal, fontSize: 14 }}>
                  <KV label="Дата">{o.createdAt}</KV>
                  <KV label="Сумма">{o.total} ₽</KV>
                  <KV label="Позиций">{o.items.length}</KV>
                  <KV label="Доставка">{o.deliveryType}</KV>
                </div>
                <div className="mt-3 text-right">
                  <button style={{ color: BRAND.navy }}>Подробнее</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: BRAND.slate, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}
