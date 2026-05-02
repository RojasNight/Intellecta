import { ArrowLeft, Heart, Info, ShoppingCart, Sparkles, Star } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { BRAND } from "./brand";
import { BOOKS } from "./data";
import { useAppContext } from "./Root";
import {
  AvailabilityBadge,
  BookCard,
  Breadcrumbs,
  ComplexityScale,
  FormatBadge,
  GhostButton,
  Notice,
  PrimaryButton,
  SectionTitle,
  SemanticBadge,
} from "./shared";

export function BookDetailsPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { toggleFav, favorites, addToCart } = useAppContext();

  const book = BOOKS.find((b) => b.id === bookId);

  if (!book) {
    return <Navigate to="/404" replace />;
  }

  const similar = BOOKS.filter(
    (b) => b.id !== book.id && b.isActive && b.topics.some((t) => book.topics.includes(t))
  ).slice(0, 6);
  const fav = favorites.includes(book.id);
  const unavailable = !book.isActive || book.inStock <= 0;

  const reviews = [
    {
      name: "Мария К.",
      text: "Книга помогла переосмыслить отношения с цифровой средой. Подача ровная, без морализаторства.",
      rating: 5,
    },
    {
      name: "Денис П.",
      text: "Хороший баланс теории и личных эссе. Местами хочется примеров, но в целом — очень рекомендую.",
      rating: 4,
    },
  ];

  return (
    <main className="max-w-[1240px] mx-auto px-4 md:px-8 py-6 md:py-10 fade-in">
      <div className="mb-3">
        <Breadcrumbs
          items={[
            { label: "Главная", onClick: () => navigate("/") },
            { label: "Каталог", onClick: () => navigate("/catalog") },
            { label: book.title },
          ]}
        />
      </div>

      <button
        onClick={() => navigate("/catalog")}
        className="inline-flex items-center gap-2 mb-5"
        style={{ color: BRAND.slate }}
      >
        <ArrowLeft size={16} /> Назад в каталог
      </button>

      <div className="grid gap-8 md:gap-10 lg:grid-cols-[320px_1fr_280px]">
        {/* Cover column */}
        <div>
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: BRAND.beige,
              aspectRatio: "3 / 4",
              boxShadow: "0 12px 32px rgba(26,43,60,0.12)",
            }}
          >
            <ImageWithFallback
              src={book.coverUrl}
              alt={`Обложка книги «${book.title}»`}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <FormatBadge format={book.format} />
            <AvailabilityBadge inStock={book.inStock} isActive={book.isActive} />
          </div>
        </div>

        {/* Main content column */}
        <div>
          <h1 className="font-serif text-balance" style={{ color: BRAND.navy, fontSize: 34, lineHeight: 1.15 }}>
            {book.title}
          </h1>
          <div style={{ color: BRAND.slate, marginTop: 6 }}>{book.authors.join(", ")}</div>

          <div className="flex items-center gap-4 mt-4 flex-wrap" style={{ color: BRAND.charcoal }}>
            <span style={{ fontSize: 28 }}>{book.price} ₽</span>
            <span className="inline-flex items-center gap-1" style={{ color: BRAND.slate, fontSize: 14 }}>
              <Star size={14} /> {book.rating.toFixed(1)} · {book.reviewsCount} отзывов
            </span>
            <ComplexityScale level={book.ai.complexityLevel} />
          </div>

          {/* Inline actions for mobile/tablet (sticky aside hides on small) */}
          <div className="lg:hidden flex items-center gap-3 mt-6 flex-wrap">
            <PrimaryButton onClick={() => addToCart(book.id)} disabled={unavailable}>
              <ShoppingCart size={16} />
              {unavailable ? "Недоступно" : "Добавить в корзину"}
            </PrimaryButton>
            <GhostButton onClick={() => toggleFav(book.id)}>
              <Heart size={16} fill={fav ? BRAND.navy : "none"} />
              {fav ? "В избранном" : "В избранное"}
            </GhostButton>
          </div>

          <div className="mt-8">
            <h2 className="font-serif" style={{ color: BRAND.navy, fontSize: 20, marginBottom: 8 }}>
              Описание
            </h2>
            <p style={{ color: BRAND.charcoal, lineHeight: 1.75 }}>{book.description}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-1.5">
            {book.topics.map((t) => <SemanticBadge key={t}>{t}</SemanticBadge>)}
          </div>

          {/* AI block */}
          <section
            className="mt-8 rounded-xl border"
            style={{
              background: "linear-gradient(180deg, #FFFFFF 0%, #F7F4EE 100%)",
              borderColor: BRAND.beige,
              boxShadow: "0 1px 3px rgba(26,43,60,0.04)",
            }}
            aria-labelledby="ai-block"
          >
            <header
              className="flex items-center gap-2 px-5 py-4 border-b"
              style={{ borderColor: BRAND.beige, color: BRAND.navy }}
            >
              <Sparkles size={18} />
              <h2 id="ai-block" className="font-serif" style={{ fontSize: 18 }}>
                Интеллектуальный анализ
              </h2>
              <span style={{ color: BRAND.gray, fontSize: 12 }}>· обновлён {book.ai.updatedAt}</span>
            </header>
            <div className="p-5 space-y-5">
              <Notice tone="info">
                ИИ-анализ помогает понять содержание книги, но не заменяет официальную аннотацию.
              </Notice>

              <p style={{ color: BRAND.charcoal, lineHeight: 1.7 }}>{book.ai.summary}</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <KV label="Темы">
                  <div className="flex flex-wrap gap-1">
                    {book.ai.topics.length
                      ? book.ai.topics.map((t) => <SemanticBadge key={t}>{t}</SemanticBadge>)
                      : <span style={{ color: BRAND.slate }}>—</span>}
                  </div>
                </KV>
                <KV label="Ключевые слова">
                  <div style={{ color: BRAND.charcoal }}>{book.ai.keywords.join(", ") || "—"}</div>
                </KV>
                <KV label="Уровень сложности">
                  <ComplexityScale level={book.ai.complexityLevel} />
                </KV>
                <KV label="Эмоциональный тон">
                  <span style={{ color: BRAND.charcoal }}>{book.ai.emotionalTone}</span>
                </KV>
              </div>

              <div
                className="rounded-md p-3 flex items-start gap-2"
                style={{ background: BRAND.beige, color: BRAND.darkSlate, fontSize: 13 }}
              >
                <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>
                  Анализ создан автоматически и носит вспомогательный характер.
                </span>
              </div>

              <Notice tone="ok" title="Почему может подойти">
                Совпадает тема «{book.topics[0]}», подходит уровень сложности
                «{book.ai.complexityLevel}», похожа на книги из вашего избранного.
              </Notice>
            </div>
          </section>
        </div>

        {/* Sticky purchase column (desktop) */}
        <aside className="hidden lg:block">
          <div
            className="rounded-xl border p-5 sticky top-20"
            style={{ background: "white", borderColor: BRAND.beige, boxShadow: "0 4px 12px rgba(26,43,60,0.05)" }}
          >
            <div style={{ color: BRAND.charcoal, fontSize: 26 }}>{book.price} ₽</div>
            <div className="mt-2"><AvailabilityBadge inStock={book.inStock} isActive={book.isActive} /></div>
            <div className="mt-4 space-y-2">
              <PrimaryButton full onClick={() => addToCart(book.id)} disabled={unavailable}>
                <ShoppingCart size={16} />
                {unavailable ? "Недоступно" : "В корзину"}
              </PrimaryButton>
              <GhostButton full onClick={() => toggleFav(book.id)}>
                <Heart size={16} fill={fav ? BRAND.navy : "none"} />
                {fav ? "В избранном" : "В избранное"}
              </GhostButton>
            </div>
            <div
              className="mt-5 pt-4 border-t space-y-2"
              style={{ borderColor: BRAND.beige, color: BRAND.slate, fontSize: 13 }}
            >
              <div className="flex items-center justify-between">
                <span>Формат</span><span style={{ color: BRAND.charcoal }}>{book.format}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Сложность</span><span style={{ color: BRAND.charcoal }}>{book.ai.complexityLevel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Рейтинг</span><span style={{ color: BRAND.charcoal }}>{book.rating.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-14">
          <SectionTitle sub="Подборка по совпадающим темам">Похожие книги</SectionTitle>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 snap-x">
            {similar.map((b) => (
              <div key={b.id} className="shrink-0 snap-start" style={{ width: 220 }}>
                <BookCard
                  book={b}
                  isFav={favorites.includes(b.id)}
                  onToggleFav={() => toggleFav(b.id)}
                  onAddToCart={() => addToCart(b.id)}
                  onOpen={() => navigate(`/book/${b.id}`)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-14">
        <SectionTitle>Отзывы читателей</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((r) => (
            <div key={r.name} className="rounded-xl border p-5"
              style={{ background: "white", borderColor: BRAND.beige }}>
              <div className="flex items-center justify-between">
                <div style={{ color: BRAND.navy }}>{r.name}</div>
                <div style={{ color: BRAND.slate, fontSize: 13 }} aria-label={`Оценка ${r.rating} из 5`}>
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} size={12} style={{ display: "inline" }} fill={BRAND.navy} stroke={BRAND.navy} />
                  ))}
                </div>
              </div>
              <p style={{ color: BRAND.charcoal, marginTop: 8, lineHeight: 1.6 }}>{r.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: BRAND.slate, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}
