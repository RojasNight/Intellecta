import { toast } from "sonner";
import {
  AlertTriangle,
  BookOpen,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  Layout,
  LayoutDashboard,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { BRAND } from "./brand";
import type { AIJobRow, AIJobStatus, OrderStatus, OrderWithItems } from "./types";
import { Breadcrumbs, EmptyState, GhostButton, Notice, PrimaryButton, SectionTitle, StatusBadge } from "./shared";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useAuth } from "../auth/AuthContext";
import { clearCatalogCache } from "../../services/catalogService";
import {
  createBook,
  getAdminBooks,
  getAuthors,
  getBookForEdit,
  getGenres,
  restoreBook,
  softDeleteBook,
  updateBook,
  type Author,
  type Genre,
  type BookAdminRow,
  type BookAiProfileStatus,
  type BookFormatValue,
  type CreateBookInput,
} from "../../services/adminCatalogService";
import {
  deleteBookCoverByPath,
  extractStoragePathFromPublicUrl,
  uploadBookCover,
  validateBookCoverFile,
} from "../../services/storageService";
import { SupabaseStatus } from "./SupabaseStatus";
import { adminGetOrders, adminUpdateOrderStatus } from "../../services/orderService";
import { analyzeBook, getAdminAIJobs } from "../../services/aiAnalysisService";

type AdminTab = "overview" | "books" | "orders" | "ai" | "logs";
type BookFormSubmit = { input: CreateBookInput; coverFile: File | null };
type FormErrors = Partial<Record<
  "title" | "slug" | "description" | "price" | "format" | "stock_qty" | "year" | "authors" | "genres" | "cover",
  string
>>;

const NAV: { v: AdminTab; label: string; icon: ReactNode }[] = [
  { v: "overview", label: "Обзор", icon: <LayoutDashboard size={16} /> },
  { v: "books", label: "Книги", icon: <Layout size={16} /> },
  { v: "orders", label: "Заказы", icon: <ClipboardList size={16} /> },
  { v: "ai", label: "ИИ-анализ", icon: <Sparkles size={16} /> },
  { v: "logs", label: "Логи", icon: <FileText size={16} /> },
];

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  created: "создан",
  processing: "в обработке",
  completed: "завершен",
  cancelled: "отменен",
};

const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "created", label: "создан" },
  { value: "processing", label: "в обработке" },
  { value: "completed", label: "завершен" },
  { value: "cancelled", label: "отменен" },
];

const DELIVERY_LABELS: Record<string, string> = {
  pickup: "Самовывоз",
  courier: "Курьер",
  digital: "Электронная доставка",
};

const FORMAT_OPTIONS: Array<{ value: BookFormatValue; label: string }> = [
  { value: "paper", label: "Печатная" },
  { value: "ebook", label: "Электронная" },
  { value: "audiobook", label: "Аудио" },
];

function getFormatLabel(value: BookFormatValue) {
  return FORMAT_OPTIONS.find((item) => item.value === value)?.label ?? "Печатная";
}

function aiStatusLabel(status?: BookAiProfileStatus | null) {
  if (status === "ready") return "Готово";
  if (status === "running") return "Выполняется";
  if (status === "failed") return "Ошибка";
  return "Требуется анализ";
}

function aiStatusTone(status?: BookAiProfileStatus | null): "ok" | "warn" | "err" | "info" {
  if (status === "ready") return "ok";
  if (status === "running") return "warn";
  if (status === "failed") return "err";
  return "info";
}

function shortDate(value?: string | null) {
  return value ? value.slice(0, 10) : "—";
}

function makeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getErrorMessage(error: unknown, fallback = "Операция не выполнена.") {
  return error instanceof Error ? error.message : fallback;
}

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [books, setBooks] = useState<BookAdminRow[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [aiJobs, setAiJobs] = useState<AIJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAdmin } = useAuth();

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextBooks, nextAuthors, nextGenres, nextOrders, nextAIJobs] = await Promise.all([
        getAdminBooks(),
        getAuthors(),
        getGenres(),
        adminGetOrders(),
        getAdminAIJobs(),
      ]);
      setBooks(nextBooks);
      setAuthors(nextAuthors);
      setGenres(nextGenres);
      setOrders(nextOrders);
      setAiJobs(nextAIJobs);
    } catch (err) {
      const message = getErrorMessage(err, "Не удалось загрузить данные админ-панели.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void loadAdminData();
  }, [isAdmin, loadAdminData]);

  if (!isAdmin) {
    return (
      <main className="max-w-[900px] mx-auto px-4 md:px-8 py-10 fade-in">
        <Notice tone="err" title="Недостаточно прав">
          Административные операции доступны только пользователю с ролью admin.
        </Notice>
      </main>
    );
  }

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
        Реальное управление каталогом, заказами и серверным ИИ-анализом в Supabase/Vercel.
      </p>

      <div className="md:hidden mt-5 flex gap-2 overflow-x-auto no-scrollbar">
        {NAV.map((it) => <NavButton key={it.v} item={it} active={tab === it.v} onClick={() => setTab(it.v)} />)}
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr] mt-6 md:mt-8">
        <aside className="hidden md:block rounded-xl border p-2 h-fit" style={{ background: "white", borderColor: BRAND.beige }}>
          <nav>
            {NAV.map((it) => <NavButton key={it.v} item={it} active={tab === it.v} onClick={() => setTab(it.v)} block />)}
          </nav>
        </aside>

        <section>
          {error && (
            <div className="mb-4">
              <Notice tone="err" title="Ошибка загрузки админ-данных">
                {error}
              </Notice>
            </div>
          )}

          {tab === "overview" && <Overview books={books} orders={orders} go={setTab} loading={loading} onReload={loadAdminData} />}
          {tab === "books" && (
            <BooksTab
              books={books}
              authors={authors}
              genres={genres}
              loading={loading}
              onReload={loadAdminData}
            />
          )}
          {tab === "orders" && <OrdersTab orders={orders} setOrders={setOrders} />}
          {tab === "ai" && <AITab books={books} jobs={aiJobs} onReload={loadAdminData} />}
          {tab === "logs" && <LogsTab />}
        </section>
      </div>
    </main>
  );
}

function NavButton({ item, active, onClick, block = false }: {
  item: { label: string; icon: ReactNode };
  active: boolean;
  onClick: () => void;
  block?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`${block ? "w-full text-left" : ""} rounded-md px-3 py-2 inline-flex items-center gap-2 ${block ? "mb-1" : "shrink-0"}`}
      style={{
        background: active ? BRAND.navy : block ? "transparent" : "white",
        color: active ? "white" : BRAND.charcoal,
        border: block ? undefined : `1px solid ${active ? BRAND.navy : BRAND.lightGray}`,
        fontSize: 13,
      }}
      aria-current={active ? "page" : undefined}
    >
      {item.icon} {item.label}
    </button>
  );
}

function Overview({ books, orders, go, loading, onReload }: {
  books: BookAdminRow[];
  orders: OrderWithItems[];
  go: (t: AdminTab) => void;
  loading: boolean;
  onReload: () => Promise<void>;
}) {
  const total = books.length;
  const active = books.filter((b) => b.is_active).length;
  const aiReady = books.filter((b) => b.ai_profile?.status === "ready").length;
  const aiPending = books.filter((b) => !b.ai_profile || b.ai_profile.status === "stale" || b.ai_profile.status === "failed").length;

  return (
    <div>
      <SectionTitle sub="Сводка по каталогу и текущей Supabase-интеграции">Обзор</SectionTitle>
      <SupabaseStatus />

      <div className="mt-4 flex justify-end">
        <GhostButton onClick={() => void onReload()} disabled={loading}>
          <RefreshCw size={14} /> {loading ? "Обновляем…" : "Обновить данные"}
        </GhostButton>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 mt-5">
        <Metric icon={<BookOpen size={16} />} label="Всего книг" value={total} onClick={() => go("books")} />
        <Metric icon={<Layout size={16} />} label="Активные книги" value={active} tone="ok" onClick={() => go("books")} />
        <Metric icon={<Sparkles size={16} />} label="ИИ готов" value={aiReady} tone="info" onClick={() => go("ai")} />
        <Metric icon={<AlertTriangle size={16} />} label="Требуют анализа" value={aiPending} tone={aiPending > 0 ? "err" : "neutral"} onClick={() => go("ai")} />
        <Metric icon={<ClipboardList size={16} />} label="Заказы" value={orders.length} onClick={() => go("orders")} />
      </div>

      <div className="mt-8 rounded-xl border p-5" style={{ background: "white", borderColor: BRAND.beige }}>
        <div className="font-serif" style={{ color: BRAND.navy, fontSize: 18, marginBottom: 8 }}>
          Что реально сохраняется на текущем этапе
        </div>
        <ul className="space-y-2" style={{ color: BRAND.charcoal, fontSize: 14 }}>
          <li>• Книги, авторы/жанры-связи и cover_url сохраняются в Supabase.</li>
          <li>• Скрытие книги выполняется через <code>books.is_active = false</code>, без физического удаления.</li>
          <li>• При изменении описания AI-профиль помечается как <code>stale</code>, затем admin запускает серверный анализ.</li>
        </ul>
      </div>
    </div>
  );
}

function Metric({
  icon, label, value, tone = "neutral", onClick,
}: {
  icon: ReactNode; label: string; value: number;
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
    <button onClick={onClick} className="text-left rounded-xl border p-4 hover:shadow-md transition-shadow" style={{ background: "white", borderColor: BRAND.beige }}>
      <div className="inline-flex items-center justify-center rounded-lg mb-3" style={{ background: t.accent, color: t.fg, width: 32, height: 32 }} aria-hidden>
        {icon}
      </div>
      <div style={{ color: BRAND.slate, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: BRAND.navy, fontSize: 28, marginTop: 4 }}>{value}</div>
    </button>
  );
}

function BooksTab({ books, authors, genres, loading, onReload }: {
  books: BookAdminRow[];
  authors: Author[];
  genres: Genre[];
  loading: boolean;
  onReload: () => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden">("all");
  const [editing, setEditing] = useState<BookAdminRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [actionBookId, setActionBookId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = books;
    if (q.trim()) {
      const ql = q.toLowerCase();
      list = list.filter((b) =>
        b.title.toLowerCase().includes(ql) ||
        b.slug.toLowerCase().includes(ql) ||
        b.authors.some((a) => a.full_name.toLowerCase().includes(ql)),
      );
    }
    if (statusFilter === "active") list = list.filter((b) => b.is_active);
    if (statusFilter === "hidden") list = list.filter((b) => !b.is_active);
    return list;
  }, [books, q, statusFilter]);

  const openEditForm = async (bookId: string) => {
    setLoadingEditId(bookId);
    try {
      const fresh = await getBookForEdit(bookId);
      if (!fresh) throw new Error("Книга не найдена.");
      setEditing(fresh);
      setCreating(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Не удалось открыть книгу."));
    } finally {
      setLoadingEditId(null);
    }
  };

  const handleToggleActive = async (book: BookAdminRow) => {
    setActionBookId(book.id);
    try {
      if (book.is_active) {
        await softDeleteBook(book.id);
        toast.success("Книга скрыта из публичного каталога");
      } else {
        await restoreBook(book.id);
        toast.success("Книга восстановлена в публичном каталоге");
      }
      clearCatalogCache();
      await onReload();
    } catch (err) {
      toast.error(getErrorMessage(err, "Не удалось изменить статус книги."));
    } finally {
      setActionBookId(null);
    }
  };

  const handleSave = async ({ input, coverFile }: BookFormSubmit) => {
    setSaving(true);
    let uploadedCoverUrl: string | null = null;

    try {
      if (editing && coverFile) {
        uploadedCoverUrl = await uploadBookCover(coverFile, editing.id);
      }

      if (editing) {
        const nextInput = uploadedCoverUrl ? { ...input, cover_url: uploadedCoverUrl } : input;
        await updateBook(editing.id, nextInput);

        const oldPath = extractStoragePathFromPublicUrl(editing.cover_url ?? "");
        const newPath = extractStoragePathFromPublicUrl(nextInput.cover_url ?? "");
        if (oldPath && oldPath !== newPath) await deleteBookCoverByPath(oldPath);

        toast.success("Книга обновлена в Supabase");
      } else {
        const created = await createBook(input);
        if (coverFile) {
          try {
            uploadedCoverUrl = await uploadBookCover(coverFile, created.id);
            await updateBook(created.id, { ...input, cover_url: uploadedCoverUrl });
          } catch (coverError) {
            if (uploadedCoverUrl) {
              const uploadedPath = extractStoragePathFromPublicUrl(uploadedCoverUrl);
              if (uploadedPath) await deleteBookCoverByPath(uploadedPath);
            }
            throw new Error(`Книга создана, но обложка не загружена: ${getErrorMessage(coverError)}`);
          }
        }
        toast.success("Книга создана в Supabase");
      }

      clearCatalogCache();
      await onReload();
      setEditing(null);
      setCreating(false);
    } catch (err) {
      if (uploadedCoverUrl && editing) {
        const uploadedPath = extractStoragePathFromPublicUrl(uploadedCoverUrl);
        if (uploadedPath) await deleteBookCoverByPath(uploadedPath);
      }
      toast.error(getErrorMessage(err, "Не удалось сохранить книгу."));
    } finally {
      setSaving(false);
    }
  };

  if (creating || editing) {
    return (
      <BookForm
        book={editing}
        authors={authors}
        genres={genres}
        saving={saving}
        onCancel={() => { setEditing(null); setCreating(false); }}
        onSubmit={handleSave}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <SectionTitle sub="Создание, редактирование, скрытие и восстановление книг сохраняются в Supabase.">Книги</SectionTitle>
        <div className="flex gap-2 flex-wrap">
          <GhostButton onClick={() => void onReload()} disabled={loading}>
            <RefreshCw size={14} /> {loading ? "Обновляем…" : "Обновить"}
          </GhostButton>
          <PrimaryButton onClick={() => { setCreating(true); setEditing(null); }} disabled={loading}>
            <Plus size={16} /> Добавить книгу
          </PrimaryButton>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию, slug или автору"
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

      {loading && books.length === 0 ? (
        <Notice tone="info" title="Загружаем каталог">Получаем книги, авторов и жанры из Supabase.</Notice>
      ) : filtered.length === 0 ? (
        <EmptyState title="Книги не найдены" text="Проверьте фильтр или создайте первую книгу." />
      ) : (
        <>
          <div className="hidden md:block rounded-xl border overflow-x-auto" style={{ background: "white", borderColor: BRAND.beige }}>
            <table className="w-full text-sm" style={{ minWidth: 920 }}>
              <thead>
                <tr style={{ color: BRAND.slate, background: BRAND.cream }}>
                  <Th>Название</Th><Th>Автор</Th><Th>Цена</Th><Th>Формат</Th><Th>Статус</Th><Th>ИИ</Th><Th>Обновлено</Th><Th>Действия</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-t" style={{ borderColor: BRAND.beige }}>
                    <Td>
                      <span style={{ color: BRAND.navy }}>{b.title}</span>
                      <div style={{ color: BRAND.gray, fontSize: 12 }}>{b.slug}</div>
                    </Td>
                    <Td>{b.authors.map((a) => a.full_name).join(", ") || "—"}</Td>
                    <Td>{b.price} ₽</Td>
                    <Td>{getFormatLabel(b.format)}</Td>
                    <Td><StatusBadge status={b.is_active ? "Активна" : "Скрыта"} tone={b.is_active ? "ok" : "neutral"} /></Td>
                    <Td><StatusBadge status={aiStatusLabel(b.ai_profile?.status)} tone={aiStatusTone(b.ai_profile?.status)} /></Td>
                    <Td>{shortDate(b.updated_at)}</Td>
                    <Td>
                      <BookRowActions
                        book={b}
                        busy={actionBookId === b.id || loadingEditId === b.id}
                        onEdit={() => void openEditForm(b.id)}
                        onToggleActive={() => void handleToggleActive(b)}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {filtered.map((b) => (
              <div key={b.id} className="rounded-xl border p-4" style={{ background: "white", borderColor: BRAND.beige }}>
                <div className="font-serif" style={{ color: BRAND.navy, fontSize: 16, lineHeight: 1.3 }}>{b.title}</div>
                <div style={{ color: BRAND.slate, fontSize: 13 }}>{b.authors.map((a) => a.full_name).join(", ") || "—"}</div>
                <dl className="grid grid-cols-2 gap-2 mt-3" style={{ fontSize: 13 }}>
                  <CardKV label="Цена">{b.price} ₽</CardKV>
                  <CardKV label="Формат">{getFormatLabel(b.format)}</CardKV>
                  <CardKV label="Статус"><StatusBadge status={b.is_active ? "Активна" : "Скрыта"} tone={b.is_active ? "ok" : "neutral"} /></CardKV>
                  <CardKV label="ИИ"><StatusBadge status={aiStatusLabel(b.ai_profile?.status)} tone={aiStatusTone(b.ai_profile?.status)} /></CardKV>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <BookRowActions
                    book={b}
                    busy={actionBookId === b.id || loadingEditId === b.id}
                    onEdit={() => void openEditForm(b.id)}
                    onToggleActive={() => void handleToggleActive(b)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BookRowActions({ book, busy, onEdit, onToggleActive }: {
  book: BookAdminRow;
  busy: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 flex-wrap">
      <IconBtn aria="Редактировать" onClick={onEdit} disabled={busy}><Pencil size={14} /></IconBtn>
      <IconBtn aria={book.is_active ? "Скрыть книгу" : "Восстановить книгу"} onClick={onToggleActive} disabled={busy}>
        {book.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
      </IconBtn>
    </div>
  );
}

function BookForm({ book, authors, genres, saving, onCancel, onSubmit }: {
  book: BookAdminRow | null;
  authors: Author[];
  genres: Genre[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: BookFormSubmit) => Promise<void>;
}) {
  const [title, setTitle] = useState(book?.title ?? "");
  const [slug, setSlug] = useState(book?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(book?.slug));
  const [description, setDescription] = useState(book?.description ?? "");
  const [isbn, setIsbn] = useState(book?.isbn ?? "");
  const [publisher, setPublisher] = useState(book?.publisher ?? "");
  const [year, setYear] = useState(book?.year ? String(book.year) : "");
  const [price, setPrice] = useState(String(book?.price ?? 0));
  const [format, setFormat] = useState<BookFormatValue>(book?.format ?? "paper");
  const [coverUrl, setCoverUrl] = useState(book?.cover_url ?? "");
  const [stock, setStock] = useState(String(book?.stock_qty ?? 0));
  const [active, setActive] = useState(book?.is_active ?? true);
  const [selectedAuthorIds, setSelectedAuthorIds] = useState<string[]>(book?.authors.map((a) => a.id) ?? []);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>(book?.genres.map((g) => g.id) ?? []);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(makeSlug(value));
  };

  const handleCoverChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setErrors((current) => ({ ...current, cover: undefined }));

    if (!file) return;

    try {
      validateBookCoverFile(file);
      setCoverFile(file);
    } catch (err) {
      setCoverFile(null);
      setErrors((current) => ({ ...current, cover: getErrorMessage(err, "Некорректный файл обложки.") }));
    }
  };

  const toggleId = (ids: string[], id: string) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const normalizedSlug = slug.trim();
    const priceValue = Number(price);
    const stockValue = Number(stock);
    const yearValue = year.trim() ? Number(year) : null;
    const nextYear = new Date().getFullYear() + 1;

    if (!title.trim()) next.title = "Укажите название книги.";
    if (!normalizedSlug) next.slug = "Укажите slug.";
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
      next.slug = "Slug должен содержать только латиницу, цифры и дефисы.";
    }
    if (!description.trim()) next.description = "Добавьте описание книги.";
    else if (description.trim().length < 50) next.description = "Описание должно быть не короче 50 символов для будущего ИИ-анализа.";
    if (!Number.isFinite(priceValue) || priceValue < 0) next.price = "Цена должна быть числом не меньше 0.";
    if (!Number.isInteger(stockValue) || stockValue < 0) next.stock_qty = "Количество должно быть целым числом не меньше 0.";
    if (yearValue !== null && (!Number.isInteger(yearValue) || yearValue < 1000 || yearValue > nextYear)) {
      next.year = `Год должен быть от 1000 до ${nextYear}.`;
    }
    if (!FORMAT_OPTIONS.some((item) => item.value === format)) next.format = "Выберите корректный формат.";
    if (selectedAuthorIds.length === 0) next.authors = "Выберите хотя бы одного автора.";
    if (selectedGenreIds.length === 0) next.genres = "Выберите хотя бы один жанр.";

    if (coverFile) {
      try {
        validateBookCoverFile(coverFile);
      } catch (err) {
        next.cover = getErrorMessage(err, "Некорректный файл обложки.");
      }
    }

    return next;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSubmit({
      input: {
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim(),
        isbn: isbn.trim() || null,
        publisher: publisher.trim() || null,
        year: year.trim() ? Number(year) : null,
        price: Number(price),
        format,
        cover_url: coverUrl.trim() || null,
        stock_qty: Number(stock),
        is_active: active,
        author_ids: selectedAuthorIds,
        genre_ids: selectedGenreIds,
      },
      coverFile,
    });
  };

  return (
    <form onSubmit={submit} className="rounded-xl border p-5 md:p-6 space-y-5" style={{ background: "white", borderColor: BRAND.beige }}>
      <div>
        <div className="font-serif" style={{ color: BRAND.navy, fontSize: 22 }}>
          {book ? "Редактировать книгу" : "Новая книга"}
        </div>
        <p style={{ color: BRAND.slate, fontSize: 13, marginTop: 4 }}>
          Все изменения сохраняются в Supabase. Slug используется в публичном URL карточки книги.
        </p>
      </div>

      {(book?.ai_profile?.status === "stale" || book?.ai_profile?.status === "failed") && (
        <Notice tone="info" title="Требуется ИИ-анализ">
          Профиль книги требует повторного серверного ИИ-анализа после изменения описания.
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <AField label="Название" required error={errors.title}>
          <input value={title} onChange={(e) => handleTitleChange(e.target.value)} className="w-full rounded-md border px-3 py-2.5 outline-none" style={{ borderColor: errors.title ? "#8C2A2A" : BRAND.lightGray }} />
        </AField>
        <AField label="Slug" required error={errors.slug}>
          <input value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} placeholder="primer-knigi" className="w-full rounded-md border px-3 py-2.5 outline-none" style={{ borderColor: errors.slug ? "#8C2A2A" : BRAND.lightGray }} />
        </AField>
        <AField label="ISBN" error={undefined}>
          <input value={isbn} onChange={(e) => setIsbn(e.target.value)} className="w-full rounded-md border px-3 py-2.5 outline-none" style={{ borderColor: BRAND.lightGray }} />
        </AField>
        <AField label="Издательство" error={undefined}>
          <input value={publisher} onChange={(e) => setPublisher(e.target.value)} className="w-full rounded-md border px-3 py-2.5 outline-none" style={{ borderColor: BRAND.lightGray }} />
        </AField>
        <AField label="Год" error={errors.year}>
          <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" className="w-full rounded-md border px-3 py-2.5 outline-none" style={{ borderColor: errors.year ? "#8C2A2A" : BRAND.lightGray }} />
        </AField>
        <AField label="Цена, ₽" required error={errors.price}>
          <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-md border px-3 py-2.5 outline-none" style={{ borderColor: errors.price ? "#8C2A2A" : BRAND.lightGray }} />
        </AField>
        <AField label="Формат" required error={errors.format}>
          <select value={format} onChange={(e) => setFormat(e.target.value as BookFormatValue)} className="w-full rounded-md border px-3 py-2.5 bg-white" style={{ borderColor: errors.format ? "#8C2A2A" : BRAND.lightGray }}>
            {FORMAT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </AField>
        <AField label="Количество на складе" required error={errors.stock_qty}>
          <input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full rounded-md border px-3 py-2.5 outline-none" style={{ borderColor: errors.stock_qty ? "#8C2A2A" : BRAND.lightGray }} />
        </AField>
      </div>

      <AField label="Описание" required error={errors.description}>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="w-full rounded-md border px-3 py-2 outline-none" style={{ borderColor: errors.description ? "#8C2A2A" : BRAND.lightGray }} />
      </AField>

      <div className="grid gap-4 md:grid-cols-2">
        <RelationPicker
          label="Авторы"
          required
          error={errors.authors}
          emptyText="В Supabase пока нет авторов. Добавьте их seed-скриптом или через следующий UI-этап."
          items={authors.map((a) => ({ id: a.id, label: a.full_name }))}
          selectedIds={selectedAuthorIds}
          onToggle={(id) => setSelectedAuthorIds((ids) => toggleId(ids, id))}
        />
        <RelationPicker
          label="Жанры"
          required
          error={errors.genres}
          emptyText="В Supabase пока нет жанров. Добавьте их seed-скриптом или через следующий UI-этап."
          items={genres.map((g) => ({ id: g.id, label: g.name }))}
          selectedIds={selectedGenreIds}
          onToggle={(id) => setSelectedGenreIds((ids) => toggleId(ids, id))}
        />
      </div>

      <div className="rounded-xl border p-4" style={{ background: BRAND.cream, borderColor: BRAND.beige }}>
        <div className="font-serif" style={{ color: BRAND.navy, fontSize: 18 }}>Обложка книги</div>
        <p className="mt-1" style={{ color: BRAND.slate, fontSize: 13 }}>
          JPG, PNG или WebP, до 5 МБ. Файл загружается в bucket book-covers при сохранении формы.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-[120px_1fr] items-start">
          <div className="rounded-lg overflow-hidden" style={{ width: 112, height: 160, background: BRAND.beige }}>
            <ImageWithFallback src={coverPreview ?? coverUrl} alt={`Обложка книги ${title || "без названия"}`} className="w-full h-full object-cover" />
          </div>
          <div className="space-y-3">
            <AField label="Публичный URL обложки" error={undefined}>
              <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." className="w-full rounded-md border px-3 py-2.5 outline-none" style={{ borderColor: BRAND.lightGray }} />
            </AField>
            <label className="inline-flex items-center justify-center rounded-md border px-4 py-2 cursor-pointer" style={{ background: "white", borderColor: BRAND.lightGray, color: BRAND.navy }}>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleCoverChange} disabled={saving} />
              {coverFile ? `Выбран файл: ${coverFile.name}` : "Выбрать файл обложки"}
            </label>
            <div className="flex gap-2 flex-wrap">
              {coverFile && <GhostButton onClick={() => setCoverFile(null)} disabled={saving}>Убрать выбранный файл</GhostButton>}
              {coverUrl && <GhostButton onClick={() => { setCoverUrl(""); setCoverFile(null); }} disabled={saving}><Trash2 size={14} /> Удалить текущую обложку</GhostButton>}
            </div>
            {errors.cover && <Notice tone="err" title="Некорректная обложка">{errors.cover}</Notice>}
          </div>
        </div>
      </div>

      <label className="inline-flex items-center gap-2" style={{ color: BRAND.charcoal }}>
        <input type="checkbox" checked={active} onChange={() => setActive(!active)} style={{ accentColor: BRAND.navy }} />
        Книга активна и видна в публичном каталоге
      </label>

      <div className="flex gap-3 justify-end flex-wrap">
        <GhostButton onClick={onCancel} disabled={saving}>Отмена</GhostButton>
        <PrimaryButton type="submit" disabled={saving}>{saving ? "Сохраняем…" : book ? "Сохранить" : "Создать"}</PrimaryButton>
      </div>
    </form>
  );
}

function RelationPicker({ label, required, error, emptyText, items, selectedIds, onToggle }: {
  label: string;
  required?: boolean;
  error?: string;
  emptyText: string;
  items: Array<{ id: string; label: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <div style={{ color: BRAND.darkSlate, fontSize: 14, marginBottom: 6 }}>
        {label}{required && <span style={{ color: "#8C2A2A" }}> *</span>}
      </div>
      <div className="rounded-xl border p-3 max-h-56 overflow-auto" style={{ background: "white", borderColor: error ? "#8C2A2A" : BRAND.beige }}>
        {items.length === 0 ? (
          <div style={{ color: BRAND.slate, fontSize: 13 }}>{emptyText}</div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <label key={item.id} className="flex items-center gap-2" style={{ color: BRAND.charcoal, fontSize: 14 }}>
                <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} style={{ accentColor: BRAND.navy }} />
                {item.label}
              </label>
            ))}
          </div>
        )}
      </div>
      {error && <div style={{ color: "#8C2A2A", fontSize: 12, marginTop: 5 }}>{error}</div>}
    </div>
  );
}

function aiJobStatusLabel(status?: AIJobStatus | null) {
  if (status === "ready") return "Готово";
  if (status === "failed") return "Ошибка";
  return "Выполняется";
}

function aiJobStatusTone(status?: AIJobStatus | null): "ok" | "warn" | "err" | "info" {
  if (status === "ready") return "ok";
  if (status === "failed") return "err";
  return "warn";
}

function AITab({ books, jobs, onReload }: { books: BookAdminRow[]; jobs: AIJobRow[]; onReload: () => Promise<void> }) {
  const [runningBookIds, setRunningBookIds] = useState<string[]>([]);
  const jobsByBook = useMemo(() => {
    const map = new Map<string, AIJobRow>();
    for (const job of jobs) {
      if (!map.has(job.book_id)) map.set(job.book_id, job);
    }
    return map;
  }, [jobs]);

  const runAnalysis = async (book: BookAdminRow) => {
    setRunningBookIds((ids) => Array.from(new Set([...ids, book.id])));
    try {
      const result = await analyzeBook(book.id);
      const providerLabel = result.fallbackUsed ? "MVP fallback" : "OpenRouter";
      toast.success(`ИИ-анализ завершён: ${book.title} (${providerLabel})`);
      await onReload();
    } catch (err) {
      const message = getErrorMessage(err, "Не удалось запустить ИИ-анализ.");
      toast.error(message);
      await onReload().catch(() => undefined);
    } finally {
      setRunningBookIds((ids) => ids.filter((id) => id !== book.id));
    }
  };

  return (
    <div>
      <SectionTitle sub="Запуск анализа выполняется через Vercel Serverless Function /api/analyze-book. Frontend отправляет только admin session token; OpenRouter API key и service role key остаются на сервере.">
        ИИ-анализ книг
      </SectionTitle>
      <Notice tone="info" title="Stage 17: серверный AI-analysis lifecycle">
        Кнопка запуска создает job в <code>ai_analysis_jobs</code>, анализирует описание книги, сохраняет признаки в <code>book_ai_profiles</code> и обновляет статус на <code>ready</code> или <code>failed</code>. Если OpenRouter недоступен, исчерпал лимит, вернул ошибку или невалидный JSON, используется безопасный MVP fallback на сервере.
      </Notice>

      <div className="space-y-3 mt-4">
        {books.map((b) => {
          const latestJob = jobsByBook.get(b.id);
          const isRunning = runningBookIds.includes(b.id) || b.ai_profile?.status === "running" || latestJob?.status === "running";
          const canRun = Boolean(b.description?.trim()) && !isRunning;

          return (
            <div key={b.id} className="rounded-xl border p-5 grid gap-4 md:grid-cols-[1fr_auto]" style={{ background: "white", borderColor: BRAND.beige }}>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="font-serif" style={{ color: BRAND.navy, fontSize: 18 }}>{b.title}</div>
                  <StatusBadge status={aiStatusLabel(b.ai_profile?.status)} tone={aiStatusTone(b.ai_profile?.status)} />
                  {latestJob && <StatusBadge status={`Job: ${aiJobStatusLabel(latestJob.status)}`} tone={aiJobStatusTone(latestJob.status)} />}
                </div>
                <div className="grid gap-3 sm:grid-cols-4 mt-3" style={{ fontSize: 13 }}>
                  <CardKV label="Профиль обновлен">{shortDate(b.ai_profile?.updated_at)}</CardKV>
                  <CardKV label="Последний job">{shortDate(latestJob?.finished_at ?? latestJob?.started_at)}</CardKV>
                  <CardKV label="Темы">{b.ai_profile?.topics.join(", ") || "—"}</CardKV>
                  <CardKV label="Сложность">{b.ai_profile?.complexity_level ?? "—"}</CardKV>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 mt-3" style={{ fontSize: 13 }}>
                  <CardKV label="Ключевые слова">{b.ai_profile?.keywords.join(", ") || "—"}</CardKV>
                  <CardKV label="Эмоциональный тон">{b.ai_profile?.emotional_tone || "—"}</CardKV>
                </div>
                <div className="mt-3" style={{ color: BRAND.charcoal, fontSize: 14 }}>
                  {b.ai_profile?.summary || "ИИ-сводка пока не готова."}
                </div>
                {latestJob?.error_message && (
                  <div className="mt-3 rounded-md border px-3 py-2" style={{ color: "#8C2A2A", borderColor: "#E8C5C5", background: "#FFF8F8", fontSize: 13 }}>
                    {latestJob.error_message}
                  </div>
                )}
                {!b.description?.trim() && (
                  <div className="mt-3" style={{ color: "#8C2A2A", fontSize: 13 }}>
                    Для анализа нужно заполнить описание книги.
                  </div>
                )}
              </div>
              <div className="flex md:flex-col gap-2 md:items-end">
                <PrimaryButton disabled={!canRun} onClick={() => void runAnalysis(b)}>
                  {isRunning ? <RefreshCw size={14} /> : <Play size={14} />}
                  {isRunning ? "Анализ…" : "Запустить ИИ-анализ"}
                </PrimaryButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function orderStatusTone(status: OrderStatus): "ok" | "warn" | "err" | "info" {
  if (status === "completed") return "ok";
  if (status === "cancelled") return "err";
  if (status === "processing") return "warn";
  return "info";
}

function formatOrderDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

function shortOrderId(id: string) {
  return `#${id.slice(0, 8)}`;
}

function OrdersTab({ orders, setOrders }: { orders: OrderWithItems[]; setOrders: (o: OrderWithItems[]) => void }) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const changeStatus = async (orderId: string, status: OrderStatus) => {
    const previous = orders;
    setUpdatingId(orderId);
    setOrders(orders.map((order) => order.id === orderId ? { ...order, status } : order));

    try {
      const updated = await adminUpdateOrderStatus(orderId, status);
      setOrders(orders.map((order) => order.id === orderId ? { ...updated, items: order.items } : order));
      toast.success("Статус заказа обновлен");
    } catch (err) {
      const message = getErrorMessage(err, "Не удалось изменить статус заказа.");
      setOrders(previous);
      toast.error(message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <SectionTitle sub="Заказы загружаются из Supabase; изменение статуса выполняется через admin RPC.">Заказы</SectionTitle>
      {orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={18} />}
          title="Заказов пока нет"
          text="После оформления заказа пользователем записи появятся в public.orders и public.order_items."
        />
      ) : (
        <>
          <div className="hidden md:block rounded-xl border overflow-x-auto" style={{ background: "white", borderColor: BRAND.beige }}>
            <table className="w-full text-sm" style={{ minWidth: 860 }}>
              <thead>
                <tr style={{ color: BRAND.slate, background: BRAND.cream }}>
                  <Th>Заказ</Th><Th>Клиент</Th><Th>Дата</Th><Th>Сумма</Th><Th>Получение</Th><Th>Статус</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t" style={{ borderColor: BRAND.beige }}>
                    <Td><span style={{ color: BRAND.navy }}>{shortOrderId(o.id)}</span></Td>
                    <Td>{o.contact_json.name || o.contact_json.email || o.user_id.slice(0, 8)}</Td>
                    <Td>{formatOrderDate(o.created_at)}</Td>
                    <Td>{o.total_amount} ₽</Td>
                    <Td>{DELIVERY_LABELS[o.delivery_type] ?? o.delivery_type}</Td>
                    <Td>
                      <div className="inline-flex items-center gap-2">
                        <StatusBadge status={ORDER_STATUS_LABELS[o.status]} tone={orderStatusTone(o.status)} />
                        <select
                          value={o.status}
                          disabled={updatingId === o.id}
                          onChange={(e) => void changeStatus(o.id, e.target.value as OrderStatus)}
                          className="rounded-md border px-2 py-1 bg-white disabled:opacity-60"
                          style={{ borderColor: BRAND.lightGray, fontSize: 12 }}
                          aria-label={`Изменить статус заказа ${o.id}`}
                        >
                          {ORDER_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </Td>
                    <Td>
                      <button onClick={() => setExpandedId(expandedId === o.id ? null : o.id)} style={{ color: BRAND.navy }}>
                        {expandedId === o.id ? "Скрыть" : "Состав"}
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="rounded-xl border p-4" style={{ background: "white", borderColor: BRAND.beige }}>
                <div className="flex items-center justify-between gap-2">
                  <div style={{ color: BRAND.navy }}>{shortOrderId(o.id)}</div>
                  <StatusBadge status={ORDER_STATUS_LABELS[o.status]} tone={orderStatusTone(o.status)} />
                </div>
                <dl className="grid grid-cols-2 gap-2 mt-3" style={{ fontSize: 13 }}>
                  <CardKV label="Клиент">{o.contact_json.name || o.contact_json.email || "—"}</CardKV>
                  <CardKV label="Дата">{formatOrderDate(o.created_at)}</CardKV>
                  <CardKV label="Сумма">{o.total_amount} ₽</CardKV>
                  <CardKV label="Получение">{DELIVERY_LABELS[o.delivery_type] ?? o.delivery_type}</CardKV>
                </dl>
                <div className="mt-3">
                  <select
                    value={o.status}
                    disabled={updatingId === o.id}
                    onChange={(e) => void changeStatus(o.id, e.target.value as OrderStatus)}
                    className="w-full rounded-md border px-2 py-2 bg-white disabled:opacity-60"
                    style={{ borderColor: BRAND.lightGray, fontSize: 13 }}
                  >
                    {ORDER_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <button className="mt-3" onClick={() => setExpandedId(expandedId === o.id ? null : o.id)} style={{ color: BRAND.navy }}>
                  {expandedId === o.id ? "Скрыть состав" : "Показать состав"}
                </button>
                {expandedId === o.id && <AdminOrderItems order={o} />}
              </div>
            ))}
          </div>

          {expandedId && (
            <div className="hidden md:block mt-4">
              {orders.filter((order) => order.id === expandedId).map((order) => <AdminOrderItems key={order.id} order={order} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AdminOrderItems({ order }: { order: OrderWithItems }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: BRAND.cream, borderColor: BRAND.beige }}>
      <div className="grid gap-2 sm:grid-cols-3" style={{ color: BRAND.charcoal, fontSize: 13 }}>
        <CardKV label="Email">{order.contact_json.email || "—"}</CardKV>
        <CardKV label="Телефон">{order.contact_json.phone || "—"}</CardKV>
        <CardKV label="Адрес">{order.contact_json.address || "—"}</CardKV>
      </div>
      {order.comment && <div className="mt-3" style={{ color: BRAND.charcoal, fontSize: 13 }}>{order.comment}</div>}
      <div className="mt-4 space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-3" style={{ color: BRAND.charcoal, fontSize: 14 }}>
            <span>{item.title_snapshot} × {item.quantity}</span>
            <span>{item.price_snapshot * item.quantity} ₽</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogsTab() {
  const logs = [
    { ts: "2026-05-13 14:30", level: "info", msg: "Stage 17: ИИ-анализ запускается через серверную функцию /api/analyze-book" },
    { ts: "2026-05-13 14:20", level: "info", msg: "book_ai_profiles и ai_analysis_jobs защищены RLS от прямой записи из frontend" },
    { ts: "2026-05-13 14:10", level: "warn", msg: "Если OPENROUTER_API_KEY не задан или OpenRouter недоступен, используется серверный MVP fallback-анализ" },
  ];
  return (
    <div>
      <SectionTitle>Логи</SectionTitle>
      <div className="rounded-xl border overflow-hidden" style={{ background: "white", borderColor: BRAND.beige }}>
        {logs.map((l, i) => (
          <div key={i} className="px-5 py-3 border-b grid grid-cols-[140px_70px_1fr] gap-3" style={{ borderColor: BRAND.beige, fontSize: 13, color: BRAND.charcoal }}>
            <span style={{ color: BRAND.gray }}>{l.ts}</span>
            <span style={{ color: l.level === "error" ? "#8C2A2A" : l.level === "warn" ? "#6B4E12" : BRAND.slate, textTransform: "uppercase", letterSpacing: "0.04em" }}>{l.level}</span>
            <span>{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Th({ children }: { children?: ReactNode }) {
  return <th className="text-left px-5 py-3" style={{ fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>{children}</th>;
}

function Td({ children }: { children?: ReactNode }) {
  return <td className="px-5 py-3" style={{ color: BRAND.charcoal }}>{children}</td>;
}

function IconBtn({ children, onClick, aria, disabled }: { children: ReactNode; onClick: () => void; aria: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} aria-label={aria} disabled={disabled} className="p-2 rounded-md border disabled:opacity-50" style={{ borderColor: BRAND.lightGray, color: BRAND.slate, background: "white" }}>
      {children}
    </button>
  );
}

function AField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span style={{ color: BRAND.darkSlate, fontSize: 14, display: "block", marginBottom: 6 }}>
        {label}{required && <span style={{ color: "#8C2A2A" }}> *</span>}
      </span>
      {children}
      {error && <span style={{ color: "#8C2A2A", fontSize: 12, marginTop: 5, display: "block" }}>{error}</span>}
    </label>
  );
}

function CardKV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ color: BRAND.slate, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: BRAND.charcoal }}>{children}</div>
    </div>
  );
}
