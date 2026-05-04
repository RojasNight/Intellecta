import { CheckCircle2, Heart, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { BRAND } from "./brand";
import { BOOKS } from "./data";
import { useAppContext } from "./Root";
import type { Order } from "./types";
import { EmptyState, GhostButton, Notice, PrimaryButton, SectionTitle, SemanticBadge, StatusBadge } from "./shared";

/* ---------- FAVORITES ---------- */

export function FavoritesPage() {
  const navigate = useNavigate();
  const { favorites, toggleFav, addToCart } = useAppContext();
  const list = BOOKS.filter((b) => favorites.includes(b.id));
  return (
    <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 md:py-10 fade-in">
      <SectionTitle sub="Книги, к которым вы хотите вернуться позже">Избранное</SectionTitle>
      {list.length === 0 ? (
        <EmptyState
          icon={<Heart size={22} />}
          title="В избранном пока нет книг"
          text="Добавляйте книги, чтобы возвращаться к ним позже."
          action={<PrimaryButton onClick={() => navigate("/catalog")}>Перейти в каталог</PrimaryButton>}
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {list.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border p-4 flex gap-4 book-card"
              style={{ background: "white", borderColor: BRAND.beige }}
            >
              <button
                onClick={() => navigate(`/book/${b.id}`)}
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
                      className="p-2 rounded-full border"
                      style={{ borderColor: BRAND.lightGray, color: BRAND.navy, background: "white" }}
                      aria-label="Убрать из избранного"
                    >
                      <Heart size={14} fill={BRAND.navy} stroke={BRAND.navy} />
                    </button>
                    <button
                      onClick={() => addToCart(b.id)}
                      className="rounded-md px-3 py-2 inline-flex items-center gap-2"
                      style={{ background: BRAND.navy, color: "white", fontSize: 13 }}
                    >
                      <ShoppingBag size={14} /> В корзину
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

/* ---------- CART ---------- */

export function CartPage() {
  const navigate = useNavigate();
  const { cart, setQty, removeItem, user } = useAppContext();
  const isAuthed = !!user;
  const [promo, setPromo] = useState("");
  const items = cart.map((c) => ({ ...c, book: BOOKS.find((b) => b.id === c.bookId)! })).filter((x) => x.book);
  const total = items.reduce((s, it) => s + it.book.price * it.qty, 0);
  const hasUnavailable = items.some((it) => !it.book.isActive || it.book.inStock <= 0);

  if (items.length === 0) {
    return (
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-10 fade-in">
        <SectionTitle>Корзина</SectionTitle>
        <EmptyState
          icon={<ShoppingBag size={22} />}
          title="Корзина пуста"
          text="Добавьте книги из каталога или рекомендаций — мы поможем выбрать осознанно."
          action={<PrimaryButton onClick={() => navigate("/catalog")}>В каталог</PrimaryButton>}
        />
      </main>
    );
  }

  return (
    <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 md:py-10 fade-in">
      <SectionTitle>Корзина</SectionTitle>

      {hasUnavailable && (
        <div className="mb-4">
          <Notice tone="err" title="Часть позиций недоступна">
            Удалите такие книги из корзины или измените количество, чтобы продолжить оформление.
          </Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {items.map((it) => {
            const b = it.book;
            const unavailable = !b.isActive || b.inStock <= 0;
            return (
              <div
                key={b.id}
                className="rounded-xl border p-4 flex flex-col sm:flex-row gap-4"
                style={{ background: "white", borderColor: BRAND.beige }}
              >
                <div className="flex gap-4 flex-1 min-w-0">
                  <div
                    className="shrink-0 rounded-md overflow-hidden"
                    style={{ width: 72, height: 100, background: BRAND.beige }}
                  >
                    <ImageWithFallback src={b.coverUrl} alt={`Обложка книги «${b.title}»`} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-serif" style={{ color: BRAND.navy, fontSize: 16, lineHeight: 1.3 }}>{b.title}</div>
                    <div style={{ color: BRAND.slate, fontSize: 13 }}>{b.authors.join(", ")}</div>
                    <div style={{ color: BRAND.gray, fontSize: 13, marginTop: 4 }}>
                      {b.price} ₽ × {it.qty}
                    </div>
                    {unavailable && (
                      <div className="mt-2">
                        <StatusBadge status="Недоступно" tone="err" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3 shrink-0">
                  <Stepper qty={it.qty} max={Math.max(1, b.inStock || 1)}
                    onChange={(n) => setQty(b.id, Math.max(1, Math.min(b.inStock || 1, n)))} />
                  <div className="flex items-center gap-2">
                    <span style={{ color: BRAND.charcoal }}>{b.price * it.qty} ₽</span>
                    <button
                      onClick={() => removeItem(b.id)}
                      className="p-2 rounded-md"
                      style={{ color: BRAND.slate }}
                      aria-label="Удалить из корзины"
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
            <span>Товары ({items.length})</span><span>{total} ₽</span>
          </div>
          <div className="flex items-center justify-between mt-2" style={{ color: BRAND.slate, fontSize: 14 }}>
            <span>Доставка</span><span>при оформлении</span>
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
            <PrimaryButton full onClick={() => navigate("/checkout")} disabled={hasUnavailable}>
              Оформить заказ
            </PrimaryButton>
          </div>
          {!isAuthed && (
            <div style={{ color: BRAND.slate, fontSize: 12, marginTop: 8, textAlign: "center" }}>
              Для оформления потребуется войти в аккаунт.
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function Stepper({ qty, onChange, max = 99 }: { qty: number; onChange: (n: number) => void; max?: number }) {
  return (
    <div
      className="inline-flex items-center rounded-md border"
      style={{ borderColor: BRAND.lightGray, background: "white" }}
      role="group" aria-label="Количество"
    >
      <button onClick={() => onChange(qty - 1)} disabled={qty <= 1}
        className="p-2 disabled:opacity-40" aria-label="Уменьшить">
        <Minus size={14} />
      </button>
      <span className="px-3" style={{ color: BRAND.charcoal, minWidth: 28, textAlign: "center" }}>{qty}</span>
      <button onClick={() => onChange(qty + 1)} disabled={qty >= max}
        className="p-2 disabled:opacity-40" aria-label="Увеличить">
        <Plus size={14} />
      </button>
    </div>
  );
}

/* ---------- CHECKOUT ---------- */

export function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, setOrders, user, clearCart } = useAppContext();
  const prefill = { name: user?.name, email: user?.email };

  const items = cart.map((c) => ({ ...c, book: BOOKS.find((b) => b.id === c.bookId)! })).filter((x) => x.book);
  const total = items.reduce((s, it) => s + it.book.price * it.qty, 0);

  const [name, setName] = useState(prefill?.name ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [phone, setPhone] = useState("");
  const [delivery, setDelivery] = useState("Курьер");
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { [k: string]: string } = {};
    if (!name.trim()) errs.name = "Укажите имя";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Неверный email";
    if (phone.replace(/\D/g, "").length < 10) errs.phone = "Укажите телефон";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const order: Order = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      status: "создан",
      total,
      contact: { name, email, phone },
      deliveryType: delivery,
      items: items.map((it) => ({ bookId: it.book.id, title: it.book.title, qty: it.qty, price: it.book.price })),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setOrders((prev) => [order, ...prev]);
    setCreatedOrder(order);
    clearCart();
    toast.success("Заказ успешно создан!");
  };

  if (createdOrder) {
    return (
      <main className="max-w-2xl mx-auto px-4 md:px-8 py-10 md:py-14 fade-in">
        <div
          className="rounded-2xl border p-8 md:p-10"
          style={{ background: "white", borderColor: BRAND.beige, boxShadow: "0 8px 24px rgba(26,43,60,0.06)" }}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className="rounded-full inline-flex items-center justify-center"
              style={{ width: 64, height: 64, background: "#E5EFE6", color: "#2E5E37" }}
              aria-hidden
            >
              <CheckCircle2 size={32} />
            </div>
            <h1 className="font-serif mt-4" style={{ color: BRAND.navy, fontSize: 30 }}>Заказ создан</h1>
            <p style={{ color: BRAND.slate, marginTop: 8, lineHeight: 1.6 }}>
              Мы сохранили ваш заказ со статусом «создан» и пришлём подтверждение на указанный email.
            </p>
            <div className="mt-3"><StatusBadge status={`Статус: ${createdOrder.status}`} tone="info" /></div>
          </div>

          <dl
            className="mt-8 grid gap-3 sm:grid-cols-2 rounded-xl p-5"
            style={{ background: BRAND.cream, border: `1px solid ${BRAND.beige}` }}
          >
            <Row label="Номер заказа">{createdOrder.id}</Row>
            <Row label="Дата">{createdOrder.createdAt}</Row>
            <Row label="Способ доставки">{createdOrder.deliveryType}</Row>
            <Row label="Сумма">{createdOrder.total} ₽</Row>
          </dl>

          <div className="mt-6">
            <div style={{ color: BRAND.darkSlate, fontSize: 13, marginBottom: 8 }}>Состав заказа</div>
            <ul className="rounded-xl border divide-y" style={{ borderColor: BRAND.beige }}>
              {createdOrder.items.map((it) => (
                <li key={it.bookId} className="flex justify-between gap-3 px-4 py-3" style={{ borderColor: BRAND.beige }}>
                  <span style={{ color: BRAND.charcoal }}>{it.title} <span style={{ color: BRAND.slate }}>× {it.qty}</span></span>
                  <span style={{ color: BRAND.charcoal }}>{it.price * it.qty} ₽</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-7 flex justify-center gap-3 flex-wrap">
            <PrimaryButton onClick={() => navigate("/orders")}>Перейти к истории заказов</PrimaryButton>
            <GhostButton onClick={() => navigate("/catalog")}>Продолжить покупки</GhostButton>
          </div>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-10 fade-in">
        <SectionTitle>Оформление заказа</SectionTitle>
        <EmptyState
          icon={<ShoppingBag size={22} />}
          title="Корзина пуста"
          text="Добавьте книги в корзину перед оформлением заказа."
          action={<PrimaryButton onClick={() => navigate("/catalog")}>Перейти в каталог</PrimaryButton>}
        />
      </main>
    );
  }

  const SummaryBlock = (
    <aside
      className="rounded-xl border p-5 h-fit"
      style={{ background: "white", borderColor: BRAND.beige }}
    >
      <div className="font-serif" style={{ color: BRAND.navy, fontSize: 18, marginBottom: 12 }}>Ваш заказ</div>
      <ul className="space-y-2 mb-4" style={{ color: BRAND.charcoal, fontSize: 14 }}>
        {items.map((it) => (
          <li key={it.book.id} className="flex justify-between gap-3">
            <span className="truncate">{it.book.title} <span style={{ color: BRAND.slate }}>× {it.qty}</span></span>
            <span>{it.book.price * it.qty} ₽</span>
          </li>
        ))}
      </ul>
      <div className="border-t pt-3" style={{ borderColor: BRAND.beige }}>
        <div className="flex justify-between" style={{ color: BRAND.charcoal, fontSize: 16 }}>
          <span>К оплате</span><span>{total} ₽</span>
        </div>
      </div>
      <div className="mt-4">
        <PrimaryButton full type="submit">Подтвердить заказ</PrimaryButton>
      </div>
      <p style={{ color: BRAND.gray, fontSize: 12, marginTop: 8 }}>
        Демонстрационный прототип, реального списания средств не происходит.
      </p>
    </aside>
  );

  return (
    <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 md:py-10 fade-in">
      <SectionTitle>Оформление заказа</SectionTitle>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]" noValidate>
        <div
          className="rounded-xl border p-5 md:p-6 space-y-5"
          style={{ background: "white", borderColor: BRAND.beige }}
        >
          <div>
            <div className="font-serif" style={{ color: BRAND.navy, fontSize: 18, marginBottom: 12 }}>
              Контактные данные
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <CField label="Имя" id="c-name" error={errors.name}>
                <input id="c-name" value={name} onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="w-full rounded-md border px-3 py-2.5 outline-none"
                  style={{ borderColor: errors.name ? "#8C2A2A" : BRAND.lightGray }} />
              </CField>
              <CField label="Email" id="c-email" error={errors.email}>
                <input id="c-email" type="email" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border px-3 py-2.5 outline-none"
                  style={{ borderColor: errors.email ? "#8C2A2A" : BRAND.lightGray }} />
              </CField>
              <CField label="Телефон" id="c-phone" error={errors.phone}>
                <input id="c-phone" type="tel" autoComplete="tel"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 ..." className="w-full rounded-md border px-3 py-2.5 outline-none"
                  style={{ borderColor: errors.phone ? "#8C2A2A" : BRAND.lightGray }} />
              </CField>
            </div>
          </div>

          <div>
            <div className="font-serif" style={{ color: BRAND.navy, fontSize: 18, marginBottom: 12 }}>
              Способ доставки
            </div>
            <div className="space-y-2">
              {["Курьер", "Самовывоз", "Почта"].map((d) => (
                <label key={d} className="flex items-center gap-2 cursor-pointer rounded-md p-2"
                  style={{ color: BRAND.charcoal, background: delivery === d ? BRAND.cream : "transparent", border: `1px solid ${delivery === d ? BRAND.beige : "transparent"}` }}>
                  <input type="radio" name="delivery" checked={delivery === d}
                    onChange={() => setDelivery(d)} style={{ accentColor: BRAND.navy }} />
                  {d}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="comment" style={{ color: BRAND.darkSlate, fontSize: 14 }}>
              Комментарий к заказу
            </label>
            <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
              className="w-full rounded-md border px-3 py-2 mt-1 outline-none"
              style={{ borderColor: BRAND.lightGray }} />
          </div>

          {/* Mobile summary collapsible */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setSummaryOpen((s) => !s)}
              className="w-full rounded-md border px-4 py-3 flex items-center justify-between"
              style={{ borderColor: BRAND.lightGray, background: BRAND.cream, color: BRAND.navy }}
              aria-expanded={summaryOpen}
            >
              <span>Сводка заказа</span>
              <span style={{ color: BRAND.charcoal }}>{total} ₽</span>
            </button>
            {summaryOpen && <div className="mt-3">{SummaryBlock}</div>}
            {!summaryOpen && (
              <div className="mt-3">
                <PrimaryButton full type="submit">Подтвердить заказ · {total} ₽</PrimaryButton>
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:block">{SummaryBlock}</div>
      </form>
    </main>
  );
}

function CField({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} style={{ color: BRAND.darkSlate, fontSize: 14, display: "block", marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {error && <div role="alert" style={{ color: "#8C2A2A", fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt style={{ color: BRAND.slate, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</dt>
      <dd style={{ color: BRAND.charcoal, marginTop: 2 }}>{children}</dd>
    </div>
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
