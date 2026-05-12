import { Search, Sparkles, BookOpen, Lightbulb, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { BRAND } from "./brand";
import { getCatalogBooks } from "../../services/catalogService";
import { useAppContext } from "./Root";
import { BookCard, GhostButton, Notice, PrimaryButton, SectionTitle, SkeletonCard } from "./shared";
import type { Book } from "./types";

export function HomePage() {
  const [q, setQ] = useState("");
  const [popular, setPopular] = useState<Book[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const navigate = useNavigate();
  const { toggleFav, favorites, favoritePendingIds, addToCart, setSearchQuery } = useAppContext();

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearchQuery(q || "книга о самоопределении в цифровом обществе");
    navigate("/search");
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingPopular(true);
    getCatalogBooks({ sort: "rating", limit: 4 })
      .then((books) => {
        if (!cancelled) {
          if (import.meta.env.DEV) {
            console.info("[Интеллекта][home] Популярные книги загружены из Supabase", { count: books.length });
          }
          setPopular(books);
        }
      })
      .catch((err) => {
        console.error("[Интеллекта][home] popular:error", err);
        if (!cancelled) setPopular([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPopular(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <main>
      {/* Hero */}
      <section
        className="border-b"
        style={{ background: BRAND.cream, borderColor: BRAND.beige }}
      >
        <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-14 md:py-20">
          <div className="max-w-3xl">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-5"
              style={{ background: BRAND.beige, color: BRAND.darkSlate, fontSize: 12 }}
            >
              <Sparkles size={14} /> Интеллектуальный книжный магазин
            </div>
            <h1
              className="font-serif"
              style={{ color: BRAND.navy, fontSize: 44, lineHeight: 1.1, letterSpacing: "-0.01em" }}
            >
              Выбирайте книги осознанно — по&nbsp;смыслу, а не&nbsp;по&nbsp;обложке
            </h1>
            <p style={{ color: BRAND.slate, marginTop: 16, fontSize: 17, lineHeight: 1.6 }}>
              «Интеллекта» помогает находить книги, опираясь на тему, идею
              и&nbsp;настроение текста. Мы&nbsp;показываем уровень сложности
              и&nbsp;объясняем, почему книга может вам подойти.
            </p>

            <form onSubmit={submit} className="mt-8" role="search">
              <label htmlFor="hero-search" className="sr-only">
                Смысловой поиск
              </label>
              <div
                className="flex items-center gap-2 rounded-full p-2 pl-5"
                style={{
                  background: "white",
                  border: `1px solid ${BRAND.lightGray}`,
                  boxShadow: "0 4px 16px rgba(26,43,60,0.05)",
                }}
              >
                <Search size={18} style={{ color: BRAND.slate }} />
                <input
                  id="hero-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Найдите книгу по теме, идее или настроению"
                  className="flex-1 outline-none bg-transparent py-2"
                  style={{ color: BRAND.charcoal, minWidth: 0 }}
                />
                <button
                  type="submit"
                  className="rounded-full px-5 py-3 hidden sm:inline-flex items-center gap-2"
                  style={{ background: BRAND.navy, color: "white" }}
                >
                  Найти книгу
                </button>
              </div>
            </form>

            <div className="mt-5 flex flex-wrap gap-3">
              <PrimaryButton onClick={submit}>
                <Search size={16} /> Найти книгу
              </PrimaryButton>
              <GhostButton onClick={() => navigate("/recommendations")}>
                <Sparkles size={16} /> Получить рекомендации
              </GhostButton>
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="max-w-[1240px] mx-auto px-4 md:px-8 py-14">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: <Search size={20} />,
              title: "Смысловой поиск",
              text: "Запрос вроде «о самоопределении в цифровом обществе» возвращает книги по сути, а не по совпадению слов.",
            },
            {
              icon: <BookOpen size={20} />,
              title: "ИИ-анализ содержания",
              text: "Для каждой книги — краткое смысловое резюме, темы, ключевые слова, уровень сложности и тон.",
            },
            {
              icon: <Lightbulb size={20} />,
              title: "Объяснимые рекомендации",
              text: "Мы показываем, почему книга подходит вам: совпадает тема, уровень сложности, схожесть с избранным.",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-xl border p-6"
              style={{ background: "white", borderColor: BRAND.beige }}
            >
              <div
                className="inline-flex items-center justify-center rounded-lg mb-4"
                style={{ background: BRAND.beige, color: BRAND.navy, width: 40, height: 40 }}
                aria-hidden
              >
                {c.icon}
              </div>
              <div className="font-serif" style={{ color: BRAND.navy, fontSize: 20 }}>
                {c.title}
              </div>
              <p style={{ color: BRAND.slate, marginTop: 8, lineHeight: 1.6 }}>{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Popular */}
      <section className="max-w-[1240px] mx-auto px-4 md:px-8 pb-14">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <SectionTitle sub="Книги, которые сейчас выбирают читатели">Популярные книги</SectionTitle>
          <button
            onClick={() => navigate("/catalog")}
            className="inline-flex items-center gap-2"
            style={{ color: BRAND.navy }}
          >
            Весь каталог <ArrowRight size={16} />
          </button>
        </div>
        {loadingPopular ? (
          <div className="grid gap-5 grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : popular.length === 0 ? (
          <Notice tone="info">В каталоге пока нет активных книг.</Notice>
        ) : (
          <div className="grid gap-5 grid-cols-2 md:grid-cols-4">
            {popular.map((b) => (
              <BookCard
                key={b.id}
                book={b}
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

      <section className="max-w-[1240px] mx-auto px-4 md:px-8 pb-16">
        <Notice tone="info">
          ИИ-подсказки в «Интеллекте» носят вспомогательный характер. Они
          дополняют, но не заменяют официальные описания книг и редакторские
          подборки.
        </Notice>
      </section>
    </main>
  );
}
