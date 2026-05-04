import { toast } from "sonner";
import { BookOpen, ClipboardList, FileText, Layout, LayoutDashboard, Pencil, Play, Plus, RefreshCw, Sparkles, Trash2, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { BRAND } from "./brand";
import { ADMIN_ORDERS, BOOKS, GENRES } from "./data";
import type { Book, Order } from "./types";
import { Breadcrumbs, EmptyState, GhostButton, Notice, PrimaryButton, SectionTitle, StatusBadge } from "./shared";
import { SupabaseStatus } from "./SupabaseStatus";

type AdminTab = "overview" | "books" | "orders" | "ai" | "logs";

const NAV: { v: AdminTab; label: string; icon: React.ReactNode }[] = [
  { v: "overview", label: "Обзор", icon: <LayoutDashboard size={16} /> },
  { v: "books", label: "Книги", icon: <Layout size={16} /> },
  { v: "orders", label: "Заказы", icon: <ClipboardList size={16} /> },
  { v: "ai", label: "ИИ-анализ", icon: <Sparkles size={16} /> },
  { v: "logs", label: "Логи", icon: <FileText size={16} /> },
];

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [books, setBooks] = useState<Book[]>(BOOKS);
  const [orders, setOrders] = useState<Order[]>(ADMIN_ORDERS);
  const [editing, setEditing] = useState<Book | null>(null);
  const [creating, setCreating] = useState(false);
  const onToast = (message: string) => toast.success(message);

  return (
    <main className="max-w-[1240px] mx-auto px-4 md:px-8 py-6 md:py-8 fade-in">
      <Breadcrumbs items={[
        { label: "Админ", onClick: () => setTab("overview") },
        { label: NAV.find((n) => n.v === tab)?.label ?? "" },
      ]} />
      <h1 className="font-serif mt-2" style={{ color: BRAND.navy, fontSize: 28 }}>
        Панель администратора
      </h1>
      <p style={{ color: BRAND.slate, marginTop: 4, fontSize: 14 }}>
        Управление каталогом, заказами и заданиями ИИ-анализа.
      </p>

      {/* Mobile tab pills */}
      <div className="md:hidden mt-5 flex gap-2 overflow-x-auto no-scrollbar">
        {NAV.map((it) => {
          const active = tab === it.v;
          return (
            <button key={it.v} onClick={() => setTab(it.v)}
              className="rounded-full px-3 py-2 inline-flex items-center gap-2 shrink-0"
              style={{
                background: active ? BRAND.navy : "white",
                color: active ? "white" : BRAND.charcoal,
                border: `1px solid ${active ? BRAND.navy : BRAND.lightGray}`,
                fontSize: 13,
              }}>
              {it.icon} {it.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr] mt-6 md:mt-8">
        <aside className="hidden md:block rounded-xl border p-2 h-fit"
          style={{ background: "white", borderColor: BRAND.beige }}>
          <nav>
            {NAV.map((it) => {
              const active = tab === it.v;
              return (
                <button key={it.v} onClick={() => setTab(it.v)}
                  className="w-full text-left rounded-md px-3 py-2 inline-flex items-center gap-2 mb-1"
                  style={{
                    background: active ? BRAND.navy : "transparent",
                    color: active ? "white" : BRAND.charcoal,
                  }}
                  aria-current={active ? "page" : undefined}>
                  {it.icon} {it.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section>
          {tab === "overview" && <Overview books={books} orders={orders} go={setTab} />}
          {tab === "books" && (
            <BooksTab
              books={books} setBooks={setBooks}
              editing={editing} setEditing={setEditing}
              creating={creating} setCreating={setCreating}
              onToast={onToast}
            />
          )}
          {tab === "orders" && <OrdersTab orders={orders} setOrders={setOrders} />}
          {tab === "ai" && <AITab books={books} setBooks={setBooks} onToast={onToast} />}
          {tab === "logs" && <LogsTab />}
        </section>
      </div>
    </main>
  );
}

/* ---------- Overview ---------- */

function Overview({ books, orders, go }: { books: Book[]; orders: Order[]; go: (t: AdminTab) => void }) {
  const total = books.length;
  const active = books.filter((b) => b.isActive).length;
  const aiReady = books.filter((b) => b.ai.status === "Готово").length;
  const aiErrors = books.filter((b) => b.ai.status === "Ошибка").length;

  return (
    <div>
      <SectionTitle sub="Сводка по каталогу и работе ИИ-анализа">Обзор</SectionTitle>
      <SupabaseStatus />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 mt-5">
        <Metric icon={<BookOpen size={16} />} label="Всего книг" value={total} onClick={() => go("books")} />
        <Metric icon={<Layout size={16} />} label="Активные книги" value={active} tone="ok" onClick={() => go("books")} />
        <Metric icon={<Sparkles size={16} />} label="С ИИ-профилем" value={aiReady} tone="info" onClick={() => go("ai")} />
        <Metric icon={<ClipboardList size={16} />} label="Заказы" value={orders.length} onClick={() => go("orders")} />
        <Metric icon={<AlertTriangle size={16} />} label="Ошибки анализа" value={aiErrors} tone={aiErrors > 0 ? "err" : "neutral"} onClick={() => go("ai")} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-5" style={{ background: "white", borderColor: BRAND.beige }}>
          <div className="font-serif" style={{ color: BRAND.navy, fontSize: 18, marginBottom: 8 }}>
            Последние заказы
          </div>
          <ul className="divide-y" style={{ borderColor: BRAND.beige }}>
            {orders.slice(0, 4).map((o) => (
              <li key={o.id} className="flex items-center justify-between py-3"
                style={{ borderColor: BRAND.beige }}>
                <div>
                  <div style={{ color: BRAND.navy }}>{o.id}</div>
                  <div style={{ color: BRAND.slate, fontSize: 13 }}>{o.createdAt} · {o.contact.name}</div>
                </div>
                <StatusBadge status={o.status} tone={
                  o.status === "завершен" ? "ok" : o.status === "отменен" ? "err" : o.status === "в обработке" ? "warn" : "info"
                } />
              </li>
            ))}
          </ul>
          <div className="mt-3"><GhostButton onClick={() => go("orders")}>Все заказы</GhostButton></div>
        </div>
        <div className="rounded-xl border p-5" style={{ background: "white", borderColor: BRAND.beige }}>
          <div className="font-serif" style={{ color: BRAND.navy, fontSize: 18, marginBottom: 8 }}>
            Состояние ИИ-анализа
          </div>
          <ul className="space-y-2">
            {(["В очереди", "Выполняется", "Готово", "Ошибка"] as const).map((s) => {
              const count = books.filter((b) => b.ai.status === s).length;
              const tone = s === "Готово" ? "ok" : s === "Ошибка" ? "err" : s === "Выполняется" ? "warn" : "info";
              return (
                <li key={s} className="flex items-center justify-between rounded-md p-3"
                  style={{ background: BRAND.cream, border: `1px solid ${BRAND.beige}` }}>
                  <StatusBadge status={s} tone={tone as "ok" | "warn" | "err" | "info"} />
                  <span style={{ color: BRAND.charcoal }}>{count}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3"><GhostButton onClick={() => go("ai")}>Открыть ИИ-анализ</GhostButton></div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon, label, value, tone = "neutral", onClick,
}: {
  icon: React.ReactNode; label: string; value: number;
  tone?: "neutral" | "ok" | "info" | "err";
  onClick?: () => void;
}) {
  const tones = {
    neutral: { fg: BRAND.charcoal, accent: BRAND.beige },
    ok: { fg: "#2E5E37", accent: "#E5EFE6" },
    info: { fg: BRAND.navy, accent: "#DCE6F0" },
    err: { fg: "#8C2A2A", accent: "#F2DDDD" },
  } as const;
  const t = tones[tone];
  return (
    <button onClick={onClick}
      className="text-left rounded-xl border p-4 hover:shadow-md transition-shadow"
      style={{ background: "white", borderColor: BRAND.beige }}>
      <div
        className="inline-flex items-center justify-center rounded-lg mb-3"
        style={{ background: t.accent, color: t.fg, width: 32, height: 32 }}
        aria-hidden
      >{icon}</div>
      <div style={{ color: BRAND.slate, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: BRAND.navy, fontSize: 28, marginTop: 4 }}>{value}</div>
    </button>
  );
}

/* ---------- Books admin ---------- */

function BooksTab({
  books, setBooks, editing, setEditing, creating, setCreating, onToast,
}: {
  books: Book[]; setBooks: (b: Book[]) => void;
  editing: Book | null; setEditing: (b: Book | null) => void;
  creating: boolean; setCreating: (v: boolean) => void;
  onToast: (m: string) => void;
}) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden">("all");

  const filtered = useMemo(() => {
    let list = books;
    if (q.trim()) {
      const ql = q.toLowerCase();
      list = list.filter((b) =>
        b.title.toLowerCase().includes(ql) ||
        b.authors.some((a) => a.toLowerCase().includes(ql))
      );
    }
    if (statusFilter === "active") list = list.filter((b) => b.isActive);
    if (statusFilter === "hidden") list = list.filter((b) => !b.isActive);
    return list;
  }, [books, q, statusFilter]);

  if (creating || editing) {
    return (
      <BookForm
        book={editing}
        onCancel={() => { setEditing(null); setCreating(false); }}
        onSave={(b) => {
          if (editing) {
            setBooks(books.map((x) => (x.id === b.id ? b : x)));
            toast.success("Книга обновлена");
          } else {
            setBooks([{ ...b, id: `b${Date.now()}` }, ...books]);
            toast.success("Книга добавлена");
          }
          setEditing(null); setCreating(false);
        }}
      />
    );
  }

  const aiTone = (s: Book["ai"]["status"]) =>
    s === "Готово" ? "ok" : s === "Ошибка" ? "err" : s === "Выполняется" ? "warn" : "info";

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <SectionTitle>Книги</SectionTitle>
        <PrimaryButton onClick={() => setCreating(true)}>
          <Plus size={16} /> Добавить книгу
        </PrimaryButton>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию или автору"
          className="rounded-md border px-3 py-2 outline-none flex-1 min-w-[200px]"
          style={{ borderColor: BRAND.lightGray, background: "white" }}
          aria-label="Поиск книг"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-md border px-3 py-2 bg-white"
          style={{ borderColor: BRAND.lightGray }}
          aria-label="Фильтр по статусу"
        >
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="hidden">Скрытые</option>
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border overflow-x-auto" style={{ background: "white", borderColor: BRAND.beige }}>
        <table className="w-full text-sm" style={{ minWidth: 760 }}>
          <thead>
            <tr style={{ color: BRAND.slate, background: BRAND.cream }}>
              <Th>Название</Th><Th>Автор</Th><Th>Цена</Th>
              <Th>Статус</Th><Th>ИИ</Th><Th>Обновлено</Th><Th>Действия</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id} className="border-t" style={{ borderColor: BRAND.beige }}>
                <Td><span style={{ color: BRAND.navy }}>{b.title}</span></Td>
                <Td>{b.authors.join(", ")}</Td>
                <Td>{b.price} ₽</Td>
                <Td><StatusBadge status={b.isActive ? "Активна" : "Скрыта"} tone={b.isActive ? "ok" : "neutral"} /></Td>
                <Td><StatusBadge status={b.ai.status} tone={aiTone(b.ai.status) as "ok" | "warn" | "err" | "info"} /></Td>
                <Td>{b.ai.updatedAt}</Td>
                <Td><BookRowActions
                  book={b}
                  onEdit={() => setEditing(b)}
                  onToggleActive={() => {
                    setBooks(books.map((x) => x.id === b.id ? { ...x, isActive: !x.isActive } : x));
                    toast.success(b.isActive ? "Книга скрыта" : "Книга показана");
                  }}
                  onRunAI={() => {
                    setBooks(books.map((x) => x.id === b.id ? { ...x, ai: { ...x.ai, status: "В очереди" } } : x));
                    toast.success("ИИ-анализ поставлен в очередь");
                  }}
                /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((b) => (
          <div key={b.id} className="rounded-xl border p-4"
            style={{ background: "white", borderColor: BRAND.beige }}>
            <div className="font-serif" style={{ color: BRAND.navy, fontSize: 16, lineHeight: 1.3 }}>{b.title}</div>
            <div style={{ color: BRAND.slate, fontSize: 13 }}>{b.authors.join(", ")}</div>
            <dl className="grid grid-cols-2 gap-2 mt-3" style={{ fontSize: 13 }}>
              <CardKV label="Цена">{b.price} ₽</CardKV>
              <CardKV label="Обновлено">{b.ai.updatedAt}</CardKV>
              <CardKV label="Статус">
                <StatusBadge status={b.isActive ? "Активна" : "Скрыта"} tone={b.isActive ? "ok" : "neutral"} />
              </CardKV>
              <CardKV label="ИИ-анализ">
                <StatusBadge status={b.ai.status} tone={aiTone(b.ai.status) as "ok" | "warn" | "err" | "info"} />
              </CardKV>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <BookRowActions
                book={b}
                onEdit={() => setEditing(b)}
                onToggleActive={() => {
                  setBooks(books.map((x) => x.id === b.id ? { ...x, isActive: !x.isActive } : x));
                  toast.success(b.isActive ? "Книга скрыта" : "Книга показана");
                }}
                onRunAI={() => {
                  setBooks(books.map((x) => x.id === b.id ? { ...x, ai: { ...x.ai, status: "В очереди" } } : x));
                  toast.success("ИИ-анализ поставлен в очередь");
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookRowActions({
  onEdit, onToggleActive, onRunAI,
}: {
  book: Book; onEdit: () => void; onToggleActive: () => void; onRunAI: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 flex-wrap">
      <IconBtn aria="Редактировать" onClick={onEdit}><Pencil size={14} /></IconBtn>
      <IconBtn aria="Скрыть/показать" onClick={onToggleActive}><Trash2 size={14} /></IconBtn>
      <IconBtn aria="Запустить ИИ-анализ" onClick={onRunAI}><Play size={14} /></IconBtn>
    </div>
  );
}

function BookForm({
  book, onCancel, onSave,
}: {
  book: Book | null;
  onCancel: () => void;
  onSave: (b: Book) => void;
}) {
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.authors.join(", ") ?? "");
  const [description, setDescription] = useState(book?.description ?? "");
  const [genres, setGenres] = useState<string[]>(book?.genres ?? []);
  const [price, setPrice] = useState<number>(book?.price ?? 500);
  const [format, setFormat] = useState(book?.format ?? "Печатная");
  const [coverUrl, setCoverUrl] = useState(book?.coverUrl ?? "");
  const [stock, setStock] = useState<number>(book?.inStock ?? 10);
  const [active, setActive] = useState<boolean>(book?.isActive ?? true);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const b: Book = book ? { ...book } : ({} as Book);
    b.id = book?.id ?? "";
    b.slug = (title || "kniga").toLowerCase().replace(/\s+/g, "-");
    b.title = title;
    b.authors = author.split(",").map((s) => s.trim()).filter(Boolean);
    b.description = description;
    b.genres = genres;
    b.price = price;
    b.format = format as Book["format"];
    b.coverUrl = coverUrl || (book?.coverUrl ?? "");
    b.inStock = stock;
    b.isActive = active;
    b.rating = book?.rating ?? 0;
    b.reviewsCount = book?.reviewsCount ?? 0;
    b.topics = book?.topics ?? [];
    b.ai = book?.ai ?? {
      summary: "—", topics: [], keywords: [],
      complexityLevel: "Средний", emotionalTone: "—",
      status: "В очереди", updatedAt: new Date().toISOString().slice(0, 10),
    };
    onSave(b);
  };

  return (
    <form onSubmit={submit}
      className="rounded-xl border p-5 md:p-6 space-y-5"
      style={{ background: "white", borderColor: BRAND.beige }}>
      <div className="font-serif" style={{ color: BRAND.navy, fontSize: 22 }}>
        {book ? "Редактировать книгу" : "Новая книга"}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AField label="Название" required>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            required className="w-full rounded-md border px-3 py-2.5 outline-none"
            style={{ borderColor: BRAND.lightGray }} />
        </AField>
        <AField label="Автор">
          <input value={author} onChange={(e) => setAuthor(e.target.value)}
            placeholder="Через запятую" className="w-full rounded-md border px-3 py-2.5 outline-none"
            style={{ borderColor: BRAND.lightGray }} />
        </AField>
        <AField label="Цена, ₽">
          <input type="number" value={price} onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
            className="w-full rounded-md border px-3 py-2.5 outline-none"
            style={{ borderColor: BRAND.lightGray }} />
        </AField>
        <AField label="Формат">
          <select value={format} onChange={(e) => setFormat(e.target.value as Book["format"])}
            className="w-full rounded-md border px-3 py-2.5 bg-white"
            style={{ borderColor: BRAND.lightGray }}>
            <option>Печатная</option><option>Электронная</option><option>Аудио</option>
          </select>
        </AField>
        <AField label="URL обложки">
          <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://..." className="w-full rounded-md border px-3 py-2.5 outline-none"
            style={{ borderColor: BRAND.lightGray }} />
        </AField>
        <AField label="Количество на складе">
          <input type="number" value={stock} onChange={(e) => setStock(parseInt(e.target.value) || 0)}
            className="w-full rounded-md border px-3 py-2.5 outline-none"
            style={{ borderColor: BRAND.lightGray }} />
        </AField>
      </div>
      <AField label="Жанры">
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => {
            const active = genres.includes(g);
            return (
              <button type="button" key={g}
                onClick={() => setGenres((s) => s.includes(g) ? s.filter((x) => x !== g) : [...s, g])}
                aria-pressed={active}
                className="rounded-full"
                style={{
                  padding: "4px 12px", fontSize: 12,
                  background: active ? BRAND.navy : BRAND.beige,
                  color: active ? "white" : BRAND.darkSlate,
                }}>{g}</button>
            );
          })}
        </div>
      </AField>
      <AField label="Описание">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
          className="w-full rounded-md border px-3 py-2 outline-none"
          style={{ borderColor: BRAND.lightGray }} />
      </AField>
      <label className="inline-flex items-center gap-2" style={{ color: BRAND.charcoal }}>
        <input type="checkbox" checked={active} onChange={() => setActive(!active)}
          style={{ accentColor: BRAND.navy }} />
        Книга активна и видна в каталоге
      </label>
      <div className="flex gap-3 justify-end flex-wrap">
        <GhostButton onClick={onCancel}>Отмена</GhostButton>
        <PrimaryButton type="submit">{book ? "Сохранить" : "Создать"}</PrimaryButton>
      </div>
    </form>
  );
}

/* ---------- AI Tab ---------- */

function AITab({
  books, setBooks, onToast,
}: {
  books: Book[]; setBooks: (b: Book[]) => void; onToast: (m: string) => void;
}) {
  const tone = (s: Book["ai"]["status"]) =>
    s === "Готово" ? "ok" : s === "Ошибка" ? "err" : s === "Выполняется" ? "warn" : "info";

  const run = (id: string) => {
    setBooks(books.map((b) => b.id === id ? {
      ...b, ai: { ...b.ai, status: "Выполняется", updatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") },
    } : b));
    toast.success("ИИ-анализ запущен");
    setTimeout(() => {
      setBooks(books.map((b) => b.id === id ? {
        ...b, ai: { ...b.ai, status: "Готово", updatedAt: new Date().toISOString().slice(0, 10) },
      } : b));
    }, 1400);
  };

  const startedAt = (b: Book) => b.ai.status === "В очереди" ? "—" : b.ai.updatedAt;
  const finishedAt = (b: Book) => b.ai.status === "Готово" ? b.ai.updatedAt : "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <SectionTitle sub="Жизненный цикл задания: В очереди → Выполняется → Готово / Ошибка">
          ИИ-анализ книг
        </SectionTitle>
        <PrimaryButton onClick={() => toast.success("Запущен пакетный анализ")}>
          <Play size={14} /> Запустить ИИ-анализ
        </PrimaryButton>
      </div>

      <div className="space-y-3">
        {books.map((b) => (
          <div key={b.id}
            className="rounded-xl border p-5 grid gap-4 md:grid-cols-[1fr_auto]"
            style={{ background: "white", borderColor: BRAND.beige }}>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="font-serif" style={{ color: BRAND.navy, fontSize: 18 }}>{b.title}</div>
                <StatusBadge status={b.ai.status} tone={tone(b.ai.status) as "ok" | "warn" | "err" | "info"} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3 mt-3" style={{ fontSize: 13 }}>
                <CardKV label="Запущено">{startedAt(b)}</CardKV>
                <CardKV label="Завершено">{finishedAt(b)}</CardKV>
                <CardKV label="Обновлено">{b.ai.updatedAt}</CardKV>
              </div>
              {b.ai.status === "Ошибка" ? (
                <div className="mt-3">
                  <Notice tone="err" title="Анализ завершился ошибкой">
                    Не удалось обработать книгу. Попробуйте перезапустить задание.
                  </Notice>
                </div>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2" style={{ color: BRAND.charcoal, fontSize: 14 }}>
                  <CardKV label="Резюме">{b.ai.summary}</CardKV>
                  <CardKV label="Темы">{b.ai.topics.join(", ") || "—"}</CardKV>
                  <CardKV label="Ключевые слова">{b.ai.keywords.join(", ") || "—"}</CardKV>
                  <CardKV label="Сложность · тон">{b.ai.complexityLevel} · {b.ai.emotionalTone}</CardKV>
                </div>
              )}
            </div>
            <div className="flex md:flex-col items-start gap-2">
              <PrimaryButton onClick={() => run(b.id)}>
                <Play size={14} /> Запустить
              </PrimaryButton>
              {b.ai.status === "Ошибка" && (
                <GhostButton onClick={() => run(b.id)}>
                  <RefreshCw size={14} /> Повторить
                </GhostButton>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Orders admin ---------- */

function OrdersTab({ orders, setOrders }: { orders: Order[]; setOrders: (o: Order[]) => void }) {
  const tone = (s: Order["status"]) =>
    s === "завершен" ? "ok" : s === "отменен" ? "err" : s === "в обработке" ? "warn" : "info";

  return (
    <div>
      <SectionTitle>Заказы</SectionTitle>
      <div className="hidden md:block rounded-xl border overflow-x-auto" style={{ background: "white", borderColor: BRAND.beige }}>
        <table className="w-full text-sm" style={{ minWidth: 760 }}>
          <thead>
            <tr style={{ color: BRAND.slate, background: BRAND.cream }}>
              <Th>Заказ</Th><Th>Клиент</Th><Th>Дата</Th>
              <Th>Сумма</Th><Th>Доставка</Th><Th>Статус</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t" style={{ borderColor: BRAND.beige }}>
                <Td><span style={{ color: BRAND.navy }}>{o.id}</span></Td>
                <Td>{o.contact.name}</Td>
                <Td>{o.createdAt}</Td>
                <Td>{o.total} ₽</Td>
                <Td>{o.deliveryType}</Td>
                <Td>
                  <div className="inline-flex items-center gap-2">
                    <StatusBadge status={o.status} tone={tone(o.status) as "ok" | "warn" | "err" | "info"} />
                    <select
                      value={o.status}
                      onChange={(e) =>
                        setOrders(orders.map((x) =>
                          x.id === o.id ? { ...x, status: e.target.value as Order["status"] } : x
                        ))
                      }
                      className="rounded-md border px-2 py-1 bg-white"
                      style={{ borderColor: BRAND.lightGray, fontSize: 12 }}
                      aria-label={`Изменить статус заказа ${o.id}`}
                    >
                      <option>создан</option><option>в обработке</option>
                      <option>завершен</option><option>отменен</option>
                    </select>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="rounded-xl border p-4"
            style={{ background: "white", borderColor: BRAND.beige }}>
            <div className="flex items-center justify-between">
              <div style={{ color: BRAND.navy }}>{o.id}</div>
              <StatusBadge status={o.status} tone={tone(o.status) as "ok" | "warn" | "err" | "info"} />
            </div>
            <dl className="grid grid-cols-2 gap-2 mt-3" style={{ fontSize: 13 }}>
              <CardKV label="Клиент">{o.contact.name}</CardKV>
              <CardKV label="Дата">{o.createdAt}</CardKV>
              <CardKV label="Сумма">{o.total} ₽</CardKV>
              <CardKV label="Доставка">{o.deliveryType}</CardKV>
            </dl>
            <select
              value={o.status}
              onChange={(e) => setOrders(orders.map((x) =>
                x.id === o.id ? { ...x, status: e.target.value as Order["status"] } : x
              ))}
              className="mt-3 w-full rounded-md border px-2 py-2 bg-white"
              style={{ borderColor: BRAND.lightGray, fontSize: 13 }}
              aria-label={`Изменить статус заказа ${o.id}`}
            >
              <option>создан</option><option>в обработке</option>
              <option>завершен</option><option>отменен</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Logs ---------- */

function LogsTab() {
  const logs = [
    { ts: "2026-05-02 09:14", level: "info", msg: "ИИ-анализ b5: статус Выполняется" },
    { ts: "2026-05-02 08:55", level: "warn", msg: "Запрос к /api/v1/recommendations: 4.3 секунды" },
    { ts: "2026-05-01 22:10", level: "error", msg: "ИИ-анализ b8 завершился ошибкой (timeout)" },
    { ts: "2026-05-01 18:02", level: "info", msg: "Создан заказ ORD-1060" },
  ];
  return (
    <div>
      <SectionTitle>Логи</SectionTitle>
      <div className="rounded-xl border overflow-hidden" style={{ background: "white", borderColor: BRAND.beige }}>
        {logs.map((l, i) => (
          <div key={i} className="px-5 py-3 border-b grid grid-cols-[140px_70px_1fr] gap-3"
            style={{ borderColor: BRAND.beige, fontSize: 13, color: BRAND.charcoal }}>
            <span style={{ color: BRAND.gray }}>{l.ts}</span>
            <span style={{
              color: l.level === "error" ? "#8C2A2A" : l.level === "warn" ? "#6B4E12" : BRAND.slate,
              textTransform: "uppercase", letterSpacing: "0.04em",
            }}>{l.level}</span>
            <span>{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- shared bits ---------- */

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left px-5 py-3" style={{ fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>{children}</th>;
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-5 py-3" style={{ color: BRAND.charcoal }}>{children}</td>;
}
function IconBtn({ children, onClick, aria }: { children: React.ReactNode; onClick: () => void; aria: string }) {
  return (
    <button onClick={onClick} aria-label={aria}
      className="p-2 rounded-md border"
      style={{ borderColor: BRAND.lightGray, color: BRAND.slate, background: "white" }}>
      {children}
    </button>
  );
}
function AField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span style={{ color: BRAND.darkSlate, fontSize: 14, display: "block", marginBottom: 6 }}>
        {label}{required && <span style={{ color: "#8C2A2A" }}> *</span>}
      </span>
      {children}
    </label>
  );
}
function CardKV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: BRAND.slate, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: BRAND.charcoal }}>{children}</div>
    </div>
  );
}
