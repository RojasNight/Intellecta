import { ChevronRight, Heart, ShoppingCart, Sparkles, Wand2, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { BRAND } from "./brand";
import { BOOKS, GOALS, RECOMMENDATIONS, TOPICS } from "./data";
import { useAppContext } from "./Root";
import type { Complexity } from "./types";
import { GhostButton, Notice, PrimaryButton, SectionTitle, SemanticBadge, ScoreBadge, BookCard } from "./shared";

const COMPLEXITIES: Complexity[] = ["Лёгкий", "Средний", "Сложный", "Профессиональный"];

export function RecommendationsPage() {
  const navigate = useNavigate();
  const { preferences, toggleFav, favorites, addToCart, aiAvailable } = useAppContext();
  const hasPrefs = !!preferences && (preferences.genres.length > 0 || preferences.topics.length > 0);

  const [quickTopics, setQuickTopics] = useState<string[]>([]);
  const [quickGoal, setQuickGoal] = useState<string>(GOALS[0]);
  const [quickComplexity, setQuickComplexity] = useState<Complexity>("Средний");
  const [showQuick, setShowQuick] = useState(false);

  const personalized = useMemo(() => {
    if (!hasPrefs && quickTopics.length === 0) return null;
    return RECOMMENDATIONS.map((r) => ({
      rec: r,
      book: BOOKS.find((b) => b.id === r.bookId)!,
    })).filter((x) => !!x.book && x.book.isActive);
  }, [hasPrefs, quickTopics]);

  const popular = useMemo(
    () => BOOKS.filter((b) => b.isActive && b.rating >= 4.4).slice(0, 4),
    []
  );

  const popularReasons = (b: Book) => [
    "часто выбирают для саморазвития",
    "подходит для знакомства с темой",
    `высокая оценка читателей · ${b.rating.toFixed(1)}`,
  ];

  return (
    <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 md:py-10 fade-in">
      <SectionTitle sub="Подборка строится по вашим предпочтениям, избранному, просмотрам и покупкам — мы объясняем каждый выбор.">
        Персональные рекомендации
      </SectionTitle>

      {!aiAvailable && (
        <div className="mb-5">
          <Notice tone="warn" title="ИИ-рекомендации временно недоступны">
            Показаны популярные книги по вашим жанрам. Полный режим вернётся автоматически.
          </Notice>
        </div>
      )}

      {!hasPrefs && (
        <section
          className="rounded-2xl border p-6 md:p-8 mb-8"
          style={{
            background: "linear-gradient(180deg, #FFFFFF 0%, #F4F1EB 100%)",
            borderColor: BRAND.beige,
            boxShadow: "0 8px 24px rgba(26,43,60,0.05)",
          }}
        >
          <div className="flex items-start gap-4 flex-wrap">
            <div
              className="rounded-full inline-flex items-center justify-center"
              style={{ width: 48, height: 48, background: BRAND.beige, color: BRAND.navy, flexShrink: 0 }}
              aria-hidden
            >
              <Sparkles size={22} />
            </div>
            <div className="flex-1 min-w-[220px]">
              <h2 className="font-serif" style={{ color: BRAND.navy, fontSize: 24, lineHeight: 1.2 }}>
                Настройте рекомендации за 2 минуты
              </h2>
              <p style={{ color: BRAND.slate, marginTop: 6, lineHeight: 1.6 }}>
                Ответьте на несколько вопросов, и мы подберём книги по вашим
                темам, целям и уровню сложности.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <PrimaryButton onClick={() => navigate("/preferences")}>
                  <Settings2 size={16} /> Заполнить предпочтения
                </PrimaryButton>
                <GhostButton onClick={() => setShowQuick((s) => !s)}>
                  <Wand2 size={16} /> Быстрая настройка
                </GhostButton>
                <GhostButton onClick={() => navigate("/catalog")}>Показать популярные книги</GhostButton>
              </div>
            </div>
          </div>

          {showQuick && (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <QuickField label="Темы (1–3)">
                <div className="flex flex-wrap gap-1.5">
                  {TOPICS.slice(0, 8).map((t) => {
                    const active = quickTopics.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => setQuickTopics((s) =>
                          s.includes(t)
                            ? s.filter((x) => x !== t)
                            : s.length >= 3 ? s : [...s, t]
                        )}
                        aria-pressed={active}
                        className="rounded-full"
                        style={{
                          padding: "4px 10px", fontSize: 12,
                          background: active ? BRAND.navy : "white",
                          color: active ? "white" : BRAND.charcoal,
                          border: `1px solid ${active ? BRAND.navy : BRAND.lightGray}`,
                        }}
                      >{t}</button>
                    );
                  })}
                </div>
              </QuickField>
              <QuickField label="Цель чтения">
                <select
                  value={quickGoal}
                  onChange={(e) => setQuickGoal(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 bg-white"
                  style={{ borderColor: BRAND.lightGray }}
                  aria-label="Цель чтения"
                >
                  {GOALS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </QuickField>
              <QuickField label="Уровень сложности">
                <select
                  value={quickComplexity}
                  onChange={(e) => setQuickComplexity(e.target.value as Complexity)}
                  className="w-full rounded-md border px-3 py-2 bg-white"
                  style={{ borderColor: BRAND.lightGray }}
                  aria-label="Уровень сложности"
                >
                  {COMPLEXITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </QuickField>
              <div className="md:col-span-3">
                <PrimaryButton
                  onClick={() => { /* applies via personalized memo */ }}
                  disabled={quickTopics.length === 0}
                >
                  Получить быстрые рекомендации
                </PrimaryButton>
              </div>
            </div>
          )}
        </section>
      )}

      {personalized && personalized.length > 0 && (
        <section className="mb-10">
          <SectionTitle sub="С пояснениями, почему книга может вам подойти">
            {hasPrefs ? "Подобрано для вас" : "Подобрано по быстрой настройке"}
          </SectionTitle>
          <div className="space-y-4">
            {personalized.map(({ rec, book }) => (
              <article
                key={book.id}
                className="rounded-xl border p-4 md:p-5 grid gap-4 sm:grid-cols-[120px_1fr]"
                style={{ background: "white", borderColor: BRAND.beige, boxShadow: "0 1px 3px rgba(26,43,60,0.04)" }}
              >
                <button
                  onClick={() => navigate(`/book/${book.id}`)}
                  className="rounded-md overflow-hidden mx-auto sm:mx-0"
                  style={{ width: 120, height: 170, background: BRAND.beige }}
                  aria-label={`Открыть «${book.title}»`}
                >
                  <ImageWithFallback src={book.coverUrl} alt={`Обложка книги «${book.title}»`} className="w-full h-full object-cover" />
                </button>
                <div>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <button onClick={() => navigate(`/book/${book.id}`)} className="text-left">
                        <h3 className="font-serif" style={{ color: BRAND.navy, fontSize: 20, lineHeight: 1.2 }}>
                          {book.title}
                        </h3>
                        <div style={{ color: BRAND.slate, fontSize: 14 }}>{book.authors.join(", ")}</div>
                      </button>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <ScoreBadge score={rec.score} />
                      <div style={{ color: BRAND.charcoal }}>{book.price} ₽</div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {book.topics.slice(0, 4).map((t) => (
                      <SemanticBadge key={t}>{t}</SemanticBadge>
                    ))}
                  </div>

                  <ul
                    className="mt-3 grid gap-1"
                    style={{ color: BRAND.charcoal, fontSize: 14 }}
                    aria-label="Причины рекомендации"
                  >
                    {rec.reasons.map((r) => (
                      <li key={r} className="flex items-start gap-2">
                        <ChevronRight size={14} style={{ color: BRAND.slate, marginTop: 3, flexShrink: 0 }} />
                        {r}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <PrimaryButton onClick={() => addToCart(book.id)}>
                      <ShoppingCart size={14} /> В корзину
                    </PrimaryButton>
                    <GhostButton onClick={() => toggleFav(book.id)}>
                      <Heart size={14} fill={favorites.includes(book.id) ? BRAND.navy : "none"} />
                      {favorites.includes(book.id) ? "В избранном" : "В избранное"}
                    </GhostButton>
                    <GhostButton onClick={() => navigate(`/book/${book.id}`)}>Подробнее</GhostButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle sub="Если вы только присоединились — начните с этих изданий">
          {hasPrefs ? "Может также понравиться" : "Популярные книги для начала"}
        </SectionTitle>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          {popular.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              isFav={favorites.includes(b.id)}
              onToggleFav={() => toggleFav(b.id)}
              onAddToCart={() => addToCart(b.id)}
              onOpen={() => navigate(`/book/${b.id}`)}
              reasons={!hasPrefs ? popularReasons(b) : undefined}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function QuickField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: BRAND.darkSlate, fontSize: 13, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
