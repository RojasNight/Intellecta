import { ArrowLeft, Search, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { BRAND } from "./brand";
import { searchCatalogBooks } from "../../services/catalogService";
import { useAppContext } from "./Root";
import type { Book } from "./types";
import {
  BookCard,
  Breadcrumbs,
  EmptyState,
  Notice,
  SemanticBadge,
  SkeletonCard,
} from "./shared";

const QUERY_TOPICS: { match: RegExp; topics: string[] }[] = [
  { match: /цифров|онлайн|сети|интернет|алгоритм/i, topics: ["цифровое общество", "идентичность"] },
  { match: /самоопредел|выбор|личност|идент/i, topics: ["идентичность", "психология выбора", "выбор"] },
  { match: /самораз|рост|осознан/i, topics: ["саморазвитие", "личностный рост"] },
  { match: /ии|искусствен|нейросет/i, topics: ["искусственный интеллект", "этика"] },
  { match: /лидер|команд|бизнес/i, topics: ["лидерство", "будущее работы"] },
  { match: /мышл|когнит|память|внима/i, topics: ["познание", "критическое мышление"] },
];

function deriveQueryTopics(q: string): string[] {
  if (!q.trim()) return [];
  const found = new Set<string>();
  QUERY_TOPICS.forEach((p) => {
    if (p.match.test(q)) p.topics.forEach((t) => found.add(t));
  });
  return Array.from(found);
}

function scoreBook(book: Book, q: string, qTopics: string[]) {
  let score = 0;
  const matched: string[] = [];
  qTopics.forEach((t) => {
    if (book.topics.includes(t) || book.ai.topics.includes(t)) {
      score += 0.28;
      matched.push(t);
    }
  });
  const ql = q.toLowerCase();
  if (ql && book.title.toLowerCase().includes(ql)) score += 0.18;
  if (ql && book.description.toLowerCase().includes(ql)) score += 0.08;
  if (ql && book.authors.some((a) => a.toLowerCase().includes(ql))) score += 0.08;
  if (ql) {
    book.topics.forEach((t) => {
      if (t.toLowerCase().includes(ql) && !matched.includes(t)) {
        score += 0.12;
        matched.push(t);
      }
    });
  }
  return { score: Math.min(0.99, score + (book.rating - 4) * 0.05), matched };
}

export function SemanticSearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toggleFav, favorites, favoritePendingIds, addToCart, aiAvailable, searchQuery, setSearchQuery } = useAppContext();

  const query = searchParams.get("q") || searchQuery || "";
  const [draft, setDraft] = useState(query);
  const [loading, setLoading] = useState(true);
  const [catalogBooks, setCatalogBooks] = useState<Book[]>([]);

  useEffect(() => {
    if (searchQuery && !searchParams.get("q")) {
      setSearchParams({ q: searchQuery });
    }
  }, [searchQuery, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchCatalogBooks({ q: query, limit: 40 })
      .then((books) => {
        if (!cancelled) {
          if (import.meta.env.DEV) {
            console.info("[Интеллекта][semantic-search] Книги загружены из Supabase", { count: books.length });
          }
          setCatalogBooks(books);
        }
      })
      .catch((err) => {
        console.error("[Интеллекта][semantic-search] load:error", err);
        if (!cancelled) setCatalogBooks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [query]);

  const qTopics = useMemo(() => deriveQueryTopics(query), [query]);

  const results = useMemo(() => {
    return catalogBooks
      .filter((b) => b.isActive)
      .map((b) => ({ book: b, ...scoreBook(b, query, qTopics) }))
      .filter((r) => !query.trim() || r.score > 0.03)
      .sort((a, b) => b.score - a.score);
  }, [catalogBooks, query, qTopics]);

  const fallbackResults = useMemo(
    () => catalogBooks.slice(0, 6).map((b) => ({ book: b, score: 0, matched: [] as string[] })),
    [catalogBooks]
  );

  const list = aiAvailable ? results : fallbackResults;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    setSearchQuery(trimmed);
    setSearchParams({ q: trimmed });
  };

  const sampleQueries = [
    "книга о самоопределении в цифровом обществе",
    "как принимать решения осознанно",
    "этика искусственного интеллекта",
    "развитие критического мышления",
  ];

  return (
    <main className="max-w-[1240px] mx-auto px-4 md:px-8 py-6 md:py-10 fade-in">
      <div className="mb-4">
        <Breadcrumbs
          items={[
            { label: "Главная", onClick: () => navigate("/") },
            { label: "Каталог", onClick: () => navigate("/catalog") },
            { label: "Смысловой поиск" },
          ]}
        />
      </div>

      <button
        onClick={() => navigate("/catalog")}
        className="inline-flex items-center gap-2 mb-4"
        style={{ color: BRAND.slate }}
      >
        <ArrowLeft size={16} /> К каталогу
      </button>

      <header className="mb-6">
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-3"
          style={{ background: BRAND.beige, color: BRAND.darkSlate, fontSize: 12 }}
        >
          <Sparkles size={14} /> Смысловой поиск
        </div>
        <h1 className="font-serif text-balance" style={{ color: BRAND.navy, fontSize: 30, lineHeight: 1.2 }}>
          {query ? <>Результаты по запросу: «{query}»</> : "Найдите книгу по смыслу"}
        </h1>
        <p style={{ color: BRAND.slate, marginTop: 8, maxWidth: 700, lineHeight: 1.6 }}>
          Мы ищем не только точные слова, но и близкие темы, идеи и смысловые
          связи. Каждый результат сопровождается объяснением, почему он подходит.
        </p>
      </header>

      <form onSubmit={submit} className="mb-5" role="search">
        <label htmlFor="ss-q" className="sr-only">Смысловой поиск</label>
        <div
          className="flex items-center gap-2 rounded-full pl-4 pr-2 py-2"
          style={{ background: "white", border: `1px solid ${BRAND.lightGray}`, boxShadow: "0 4px 16px rgba(26,43,60,0.04)" }}
        >
          <Search size={18} style={{ color: BRAND.slate }} />
          <input
            id="ss-q"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Найдите книгу по теме, идее или настроению"
            className="flex-1 outline-none bg-transparent py-2"
            style={{ minWidth: 0 }}
          />
          <button
            type="submit"
            className="rounded-full px-4 py-2 inline-flex items-center gap-2"
            style={{ background: BRAND.navy, color: "white" }}
          >
            <Wand2 size={14} /> Найти
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap" style={{ color: BRAND.slate, fontSize: 13 }}>
          <span>Примеры:</span>
          {sampleQueries.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => { setDraft(q); setSearchQuery(q); setSearchParams({ q }); }}
              className="rounded-full"
              style={{ background: BRAND.beige, color: BRAND.darkSlate, padding: "4px 10px", fontSize: 12 }}
            >
              {q}
            </button>
          ))}
        </div>
      </form>

      {!aiAvailable && (
        <div className="mb-5">
          <Notice tone="warn" title="ИИ-поиск временно недоступен">
            Мы показали результаты обычного поиска по названию, автору и описанию.
            Смысловой поиск восстановится автоматически.
          </Notice>
        </div>
      )}

      {aiAvailable && qTopics.length > 0 && (
        <div
          className="rounded-xl border p-4 mb-6 flex items-start gap-3"
          style={{ background: "white", borderColor: BRAND.beige }}
        >
          <Sparkles size={18} style={{ color: BRAND.navy, marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ color: BRAND.navy }}>Найдено по смысловому совпадению:</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {qTopics.map((t) => (
                <SemanticBadge key={t} tone="match">{t}</SemanticBadge>
              ))}
            </div>
            <div style={{ color: BRAND.slate, fontSize: 13, marginTop: 8 }}>
              Релевантность учитывает совпадение тем, эмоционального тона и
              уровня сложности.
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              title="Ничего не найдено"
              text="Попробуйте переформулировать запрос — например, описать тему или настроение книги."
              icon={<Search size={22} />}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {list.map(({ book, score, matched }) => {
                const reasons = matched.length > 0
                  ? [`Совпадают темы: ${matched.slice(0, 3).join(", ")}`]
                  : aiAvailable
                  ? ["Совпадение по описанию книги"]
                  : ["Совпадение по тексту книги"];
                return (
                  <BookCard
                    key={book.id}
                    book={book}
                    isFav={favorites.includes(book.id)}
                    favoriteDisabled={favoritePendingIds.includes(book.id)}
                    onToggleFav={() => toggleFav(book.id)}
                    onAddToCart={() => addToCart(book.id)}
                    onOpen={() => navigate(`/book/${book.slug || book.id}`)}
                    score={aiAvailable && score > 0 ? score : undefined}
                    matched={matched}
                    reasons={aiAvailable && matched.length > 0 ? reasons : undefined}
                    semanticHint={aiAvailable && matched.length > 0}
                  />
                );
              })}
            </div>
          )}
        </section>

        <aside>
          <div
            className="rounded-xl border p-5 sticky top-20"
            style={{ background: "white", borderColor: BRAND.beige }}
          >
            <div
              className="inline-flex items-center gap-2 mb-3"
              style={{ color: BRAND.navy, fontSize: 14 }}
            >
              <Wand2 size={16} /> Как работает поиск
            </div>
            <ol className="space-y-3" style={{ color: BRAND.charcoal, fontSize: 13, lineHeight: 1.5 }}>
              {[
                "Анализируем запрос и выделяем ключевые смыслы",
                "Сравниваем смысловые признаки книг",
                "Показываем релевантные результаты с объяснением",
              ].map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span
                    className="rounded-full inline-flex items-center justify-center shrink-0"
                    style={{ width: 22, height: 22, background: BRAND.beige, color: BRAND.navy, fontSize: 12 }}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <div
              className="mt-4 pt-4 border-t"
              style={{ borderColor: BRAND.beige, color: BRAND.gray, fontSize: 12, lineHeight: 1.5 }}
            >
              ИИ-подсказки носят вспомогательный характер. Они дополняют, но не
              заменяют официальные описания книг.
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
