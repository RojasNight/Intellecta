import { ArrowLeft, Search, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { BRAND } from "./brand";
import { searchCatalogBooks } from "../../services/catalogService";
import { semanticSearchBooks, type SemanticSearchResult } from "../../services/semanticSearchService";
import { logSearch } from "../../services/userEventService";
import { useAppContext } from "./Root";
import type { Book } from "./types";
import {
  BookCard,
  Breadcrumbs,
  EmptyState,
  Notice,
  SkeletonCard,
} from "./shared";

type SearchMode = "semantic" | "text";
type SearchListItem = {
  book: Book;
  score?: number;
  matched: string[];
  reasons?: string[];
};

function normalizeTopic(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").trim();
}

function toTextList(books: Book[]): SearchListItem[] {
  return books.map((book) => ({ book, matched: [], reasons: undefined }));
}

function toSemanticList(items: SemanticSearchResult[]): SearchListItem[] {
  return items.map((item) => ({
    book: item.book,
    score: item.similarity,
    matched: item.matchedTopics.length
      ? item.matchedTopics
      : item.book.topics.filter((topic) => item.reasons.some((reason) => normalizeTopic(reason).includes(normalizeTopic(topic)))).slice(0, 3),
    reasons: item.reasons.length ? item.reasons : ["близко к запросу по смысловому описанию"],
  }));
}

export function SemanticSearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toggleFav, favorites, favoritePendingIds, cartPendingBookIds, addToCart, searchQuery, setSearchQuery } = useAppContext();

  const query = searchParams.get("q") || searchQuery || "";
  const initialMode = searchParams.get("mode") === "text" ? "text" : "semantic";
  const [draft, setDraft] = useState(query);
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<SearchListItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const lastLoggedQueryRef = useRef("");

  useEffect(() => {
    if (searchQuery && !searchParams.get("q")) {
      setSearchParams({ q: searchQuery, mode });
    }
  }, [searchQuery, searchParams, setSearchParams, mode]);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery && trimmedQuery !== lastLoggedQueryRef.current) {
      lastLoggedQueryRef.current = trimmedQuery;
      void logSearch(trimmedQuery);
    }

    let cancelled = false;
    setLoading(true);
    setNotice(null);
    setFallbackUsed(false);

    const run = async () => {
      if (!trimmedQuery) {
        const books = await searchCatalogBooks({ limit: 12 });
        return { list: toTextList(books), notice: null, fallback: false };
      }

      if (mode === "text") {
        const books = await searchCatalogBooks({ q: trimmedQuery, limit: 40 });
        return { list: toTextList(books), notice: null, fallback: false };
      }

      try {
        const response = await semanticSearchBooks({ query: trimmedQuery, limit: 40, minSimilarity: 0.35 });
        return {
          list: toSemanticList(response.items),
          notice: response.message ?? null,
          fallback: Boolean(response.fallback),
        };
      } catch (error) {
        const books = await searchCatalogBooks({ q: trimmedQuery, limit: 40 });
        const message = error instanceof Error ? error.message : "Смысловой поиск временно недоступен.";
        return {
          list: toTextList(books),
          notice: `${message} Показаны результаты обычного поиска.`,
          fallback: true,
        };
      }
    };

    run()
      .then((result) => {
        if (!cancelled) {
          setList(result.list);
          setNotice(result.notice);
          setFallbackUsed(result.fallback);
        }
      })
      .catch((error) => {
        console.error("[Интеллекта][search] load:error", error);
        if (!cancelled) {
          setList([]);
          setNotice("Не удалось выполнить поиск. Проверьте подключение к Supabase и Vercel Function.");
          setFallbackUsed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [query, mode]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    setSearchQuery(trimmed);
    setSearchParams({ q: trimmed, mode });
  };

  const changeMode = (nextMode: SearchMode) => {
    setMode(nextMode);
    if (query.trim()) setSearchParams({ q: query.trim(), mode: nextMode });
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
            { label: "Поиск" },
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
          <Sparkles size={14} /> {mode === "semantic" ? "Смысловой поиск" : "Обычный поиск"}
        </div>
        <h1 className="font-serif text-balance" style={{ color: BRAND.navy, fontSize: 30, lineHeight: 1.2 }}>
          {query ? <>Результаты по запросу: «{query}»</> : "Найдите книгу по смыслу"}
        </h1>
        <p style={{ color: BRAND.slate, marginTop: 8, maxWidth: 760, lineHeight: 1.6 }}>
          В режиме смыслового поиска запрос превращается в embedding, после чего Supabase
          сравнивает его с embedding книг через pgvector и возвращает наиболее близкие результаты.
        </p>
      </header>

      <form onSubmit={submit} className="mb-5" role="search">
        <label htmlFor="ss-q" className="sr-only">Поиск по каталогу</label>
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
          <span>Режим:</span>
          <button
            type="button"
            onClick={() => changeMode("text")}
            aria-pressed={mode === "text"}
            className="rounded-full px-3 py-1"
            style={{ background: mode === "text" ? BRAND.navy : BRAND.beige, color: mode === "text" ? "white" : BRAND.darkSlate }}
          >
            Обычный поиск
          </button>
          <button
            type="button"
            onClick={() => changeMode("semantic")}
            aria-pressed={mode === "semantic"}
            className="rounded-full px-3 py-1 inline-flex items-center gap-1.5"
            style={{ background: mode === "semantic" ? BRAND.navy : BRAND.beige, color: mode === "semantic" ? "white" : BRAND.darkSlate }}
          >
            <Sparkles size={13} /> Смысловой поиск
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap" style={{ color: BRAND.slate, fontSize: 13 }}>
          <span>Примеры:</span>
          {sampleQueries.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => { setDraft(q); setSearchQuery(q); setSearchParams({ q, mode }); }}
              className="rounded-full"
              style={{ background: BRAND.beige, color: BRAND.darkSlate, padding: "4px 10px", fontSize: 12 }}
            >
              {q}
            </button>
          ))}
        </div>
      </form>

      {notice && (
        <div className="mb-5">
          <Notice tone={fallbackUsed ? "warn" : "info"} title={fallbackUsed ? "Смысловой поиск временно недоступен" : "Информация о поиске"}>
            {notice}
          </Notice>
        </div>
      )}

      {mode === "semantic" && !fallbackUsed && query.trim() && list.length > 0 && (
        <div
          className="rounded-xl border p-4 mb-6 flex items-start gap-3"
          style={{ background: "white", borderColor: BRAND.beige }}
        >
          <Sparkles size={18} style={{ color: BRAND.navy, marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ color: BRAND.navy }}>Результаты отсортированы по cosine similarity.</div>
            <div style={{ color: BRAND.slate, fontSize: 13, marginTop: 6 }}>
              На карточках показан процент совпадения и 1–3 причины подбора.
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
              text="Попробуйте переформулировать запрос — например, описать тему, проблему или настроение книги."
              icon={<Search size={22} />}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {list.map(({ book, score, matched, reasons }) => (
                <BookCard
                  key={book.id}
                  book={book}
                  isFav={favorites.includes(book.id)}
                  favoriteDisabled={favoritePendingIds.includes(book.id)}
                  cartDisabled={cartPendingBookIds.includes(book.id)}
                  onToggleFav={() => toggleFav(book.id)}
                  onAddToCart={() => addToCart(book.id)}
                  onOpen={() => navigate(`/book/${book.slug || book.id}`)}
                  score={mode === "semantic" && typeof score === "number" && score > 0 ? score : undefined}
                  matched={matched}
                  reasons={mode === "semantic" ? reasons : undefined}
                  semanticHint={mode === "semantic" && !fallbackUsed}
                />
              ))}
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
                "Книга получает embedding после ИИ-анализа или backfill-скрипта",
                "Запрос пользователя также превращается в embedding на сервере",
                "RPC match_books_semantic ищет близкие книги через pgvector",
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
              OpenRouter API key и Supabase service role key используются только в серверных функциях и не попадают во frontend.
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
