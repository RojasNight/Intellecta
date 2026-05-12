import { Filter, Grid3x3, List, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { BRAND } from "./brand";
import { getCatalogBooks } from "../../services/catalogService";
import { useAppContext } from "./Root";
import type { Complexity } from "./types";
import { BookCard, Breadcrumbs, EmptyState, SkeletonCard } from "./shared";

const COMPLEXITIES: Complexity[] = ["Лёгкий", "Средний", "Сложный", "Профессиональный"];
const FORMATS = ["Печатная", "Электронная", "Аудио"] as const;

export function CatalogPage() {
  const navigate = useNavigate();
  const { toggleFav, favorites, favoritePendingIds, addToCart, setSearchQuery } = useAppContext();
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [complexity, setComplexity] = useState<Complexity[]>([]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [priceMax, setPriceMax] = useState(1000);
  const [sort, setSort] = useState<"popular" | "rating" | "price" | "new">("popular");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<import("./types").Book[]>([]);

  const toggle = <T,>(arr: T[], v: T) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const reset = () => {
    setGenre([]); setTopics([]); setFormats([]); setComplexity([]);
    setOnlyAvailable(false); setPriceMax(1000);
  };

  const activeFiltersCount =
    genre.length + topics.length + formats.length + complexity.length +
    (onlyAvailable ? 1 : 0) + (priceMax !== 1000 ? 1 : 0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCatalogBooks({
      q,
      genres: genre,
      topics,
      formats,
      complexities: complexity,
      maxPrice: priceMax,
      inStock: onlyAvailable,
      sort: sort === "price" ? "price_asc" : sort === "new" ? "newest" : sort,
    })
      .then((books) => {
        if (!cancelled) {
          if (import.meta.env.DEV) {
            console.info("[Интеллекта][catalog] UI получил книги из Supabase", { count: books.length });
          }
          setResults(books);
        }
      })
      .catch((err) => {
        console.error("[Интеллекта][catalog] load:error", err);
        if (!cancelled) {
          setError("Не удалось загрузить каталог из Supabase. Проверьте book_catalog_view, RLS и переменные окружения.");
          setResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [q, genre, topics, formats, complexity, onlyAvailable, priceMax, sort]);

  const availableGenres = useMemo(() => {
    const values = Array.from(new Set(results.flatMap((b) => b.genres)));
    return values.sort((a, b) => a.localeCompare(b, "ru"));
  }, [results]);

  const availableTopics = useMemo(() => {
    const values = Array.from(new Set(results.flatMap((b) => b.topics)));
    return values.sort((a, b) => a.localeCompare(b, "ru"));
  }, [results]);

  const triggerLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 250);
  };

  const filterPanel = (
    <div className="space-y-6">
      <FilterGroup title="Жанр">
        {availableGenres.map((g) => (
          <Check key={g} label={g} checked={genre.includes(g)} onChange={() => setGenre((s) => toggle(s, g))} />
        ))}
      </FilterGroup>
      <FilterGroup title="Цена, до">
        <input
          type="range" min={300} max={1000} step={50}
          value={priceMax} onChange={(e) => setPriceMax(parseInt(e.target.value))}
          className="w-full" aria-label="Максимальная цена"
          style={{ accentColor: BRAND.navy }}
        />
        <div style={{ color: BRAND.slate, fontSize: 13 }}>до {priceMax} ₽</div>
      </FilterGroup>
      <FilterGroup title="Формат">
        {FORMATS.map((f) => (
          <Check key={f} label={f} checked={formats.includes(f)} onChange={() => setFormats((s) => toggle(s, f))} />
        ))}
      </FilterGroup>
      <FilterGroup title="Наличие">
        <Check label="Только в наличии" checked={onlyAvailable} onChange={() => setOnlyAvailable(!onlyAvailable)} />
      </FilterGroup>
      <FilterGroup title="Уровень сложности">
        {COMPLEXITIES.map((c) => (
          <Check key={c} label={c} checked={complexity.includes(c)} onChange={() => setComplexity((s) => toggle(s, c))} />
        ))}
      </FilterGroup>
      <FilterGroup title="Тема">
        <div className="flex flex-wrap gap-2">
          {availableTopics.map((t) => {
            const active = topics.includes(t);
            return (
              <button
                key={t} onClick={() => setTopics((s) => toggle(s, t))}
                aria-pressed={active}
                className="rounded-full"
                style={{
                  padding: "3px 10px", fontSize: 12,
                  background: active ? BRAND.navy : BRAND.beige,
                  color: active ? "white" : BRAND.darkSlate,
                }}
              >{t}</button>
            );
          })}
        </div>
      </FilterGroup>
      {activeFiltersCount > 0 && (
        <button
          onClick={reset}
          className="inline-flex items-center gap-2"
          style={{ color: BRAND.slate, fontSize: 13 }}
        >
          <X size={14} /> Сбросить фильтры
        </button>
      )}
    </div>
  );

  return (
    <main className="max-w-[1240px] mx-auto px-4 md:px-8 py-6 md:py-10 fade-in">
      <div className="mb-3">
        <Breadcrumbs items={[{ label: "Главная", onClick: () => navigate("/") }, { label: "Каталог" }]} />
      </div>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="font-serif text-balance" style={{ color: BRAND.navy, fontSize: 30, lineHeight: 1.2 }}>
            Каталог книг
          </h1>
          <div style={{ color: BRAND.slate, marginTop: 4, fontSize: 14 }}>
            {results.length} {pluralBooks(results.length)} в подборке
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="sort" className="sr-only">Сортировка</label>
          <select
            id="sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-md border px-3 py-2 bg-white"
            style={{ borderColor: BRAND.lightGray, color: BRAND.charcoal, fontSize: 14 }}
          >
            <option value="popular">Популярные</option>
            <option value="rating">По рейтингу</option>
            <option value="price">По цене</option>
            <option value="new">Новинки</option>
          </select>
          <div className="hidden md:inline-flex border rounded-md overflow-hidden" style={{ borderColor: BRAND.lightGray }}>
            <button
              onClick={() => setView("grid")} aria-pressed={view === "grid"} aria-label="Сетка"
              className="p-2"
              style={{ background: view === "grid" ? BRAND.beige : "white", color: BRAND.navy }}
            ><Grid3x3 size={16} /></button>
            <button
              onClick={() => setView("list")} aria-pressed={view === "list"} aria-label="Список"
              className="p-2"
              style={{ background: view === "list" ? BRAND.beige : "white", color: BRAND.navy }}
            ><List size={16} /></button>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden inline-flex items-center gap-2 rounded-md px-3 py-2 border"
            style={{ borderColor: BRAND.lightGray, color: BRAND.navy }}
          >
            <SlidersHorizontal size={16} /> Фильтры
            {activeFiltersCount > 0 && (
              <span
                className="rounded-full"
                style={{ background: BRAND.navy, color: "white", padding: "0 6px", fontSize: 11, minWidth: 18, textAlign: "center" }}
              >{activeFiltersCount}</span>
            )}
          </button>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); triggerLoading(); }}
        className="mb-5" role="search"
      >
        <label htmlFor="cat-search" className="sr-only">Поиск по каталогу</label>
        <div
          className="flex items-center gap-2 rounded-full px-4"
          style={{ background: "white", border: `1px solid ${BRAND.lightGray}` }}
        >
          <Search size={18} style={{ color: BRAND.slate }} />
          <input
            id="cat-search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Название, автор или тема"
            className="flex-1 outline-none bg-transparent py-3"
            style={{ minWidth: 0 }}
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Очистить">
              <X size={16} style={{ color: BRAND.slate }} />
            </button>
          )}
        </div>
        {q.trim().length > 3 && (
          <div className="mt-2 inline-flex items-center gap-2" style={{ color: BRAND.slate, fontSize: 13 }}>
            <Sparkles size={14} />
            <button onClick={() => { setSearchQuery(q); navigate("/search"); }} type="button" style={{ color: BRAND.navy }}>
              Найти «{q}» по смыслу →
            </button>
          </div>
        )}
      </form>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div
            className="rounded-xl border p-5 sticky top-20"
            style={{ background: "white", borderColor: BRAND.beige }}
          >
            <div className="flex items-center justify-between mb-3">
              <div style={{ color: BRAND.navy }}>Фильтры</div>
              <Filter size={14} style={{ color: BRAND.slate }} />
            </div>
            {filterPanel}
          </div>
        </aside>

        <section>
          {error ? (
            <div className="mb-4">
              <EmptyState
                title="Не удалось загрузить каталог"
                text={error}
                icon={<Search size={22} />}
              />
            </div>
          ) : null}
          {loading ? (
            <div className={view === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              icon={<Search size={22} />}
              title="Ничего не найдено"
              text="Попробуйте уточнить запрос, изменить фильтры или сбросить ограничение по цене."
            />
          ) : view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((b) => (
                <BookCard
                  key={b.id} book={b}
                  isFav={favorites.includes(b.id)}
                  favoriteDisabled={favoritePendingIds.includes(b.id)}
                  onToggleFav={() => toggleFav(b.id)}
                  onAddToCart={() => addToCart(b.id)}
                  onOpen={() => navigate(`/book/${b.slug || b.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((b) => (
                <BookCard
                  key={b.id} book={b} variant="list"
                  isFav={favorites.includes(b.id)}
                  favoriteDisabled={favoritePendingIds.includes(b.id)}
                  onToggleFav={() => toggleFav(b.id)}
                  onAddToCart={() => addToCart(b.id)}
                  onOpen={() => navigate(`/book/${b.slug || b.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Фильтры каталога">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setDrawerOpen(false)} />
          <div
            className="absolute left-0 right-0 bottom-0 max-h-[88vh] overflow-auto rounded-t-2xl p-5"
            style={{ background: BRAND.cream }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="font-serif" style={{ color: BRAND.navy, fontSize: 20 }}>Фильтры</div>
              <button onClick={() => setDrawerOpen(false)} aria-label="Закрыть"><X size={20} /></button>
            </div>
            {filterPanel}
            <button
              onClick={() => setDrawerOpen(false)}
              className="mt-6 w-full rounded-md py-3"
              style={{ background: BRAND.navy, color: "white" }}
            >
              Показать {results.length}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function pluralBooks(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "книга";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "книги";
  return "книг";
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: BRAND.darkSlate, marginBottom: 8, fontSize: 14 }}>{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer" style={{ color: BRAND.charcoal, fontSize: 14 }}>
      <input
        type="checkbox" checked={checked} onChange={onChange}
        className="rounded" style={{ accentColor: BRAND.navy }}
      />
      {label}
    </label>
  );
}
