import { ChevronRight, Heart, RefreshCcw, Settings2, ShoppingCart, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { BRAND } from "./brand";
import { useAppContext } from "./Root";
import { useAuth } from "../auth/AuthContext";
import { getRecommendations } from "../../services/recommendationService";
import { logRecommendationClick } from "../../services/userEventService";
import type { Book, RecommendationItem } from "./types";
import {
  EmptyState,
  GhostButton,
  Notice,
  PrimaryButton,
  ScoreBadge,
  SectionTitle,
  SemanticBadge,
  SkeletonRow,
} from "./shared";

const RECOMMENDATION_LIMIT = 8;

export function RecommendationsPage() {
  const navigate = useNavigate();
  const {
    preferences,
    toggleFav,
    favorites,
    favoritePendingIds,
    cart,
    cartPendingBookIds,
    addToCart,
    aiAvailable,
  } = useAppContext();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasPrefs = Boolean(preferences && (
    preferences.genres.length > 0 ||
    preferences.topics.length > 0 ||
    preferences.goals.length > 0 ||
    preferences.excludedGenres.length > 0 ||
    preferences.complexityMin !== 1 ||
    preferences.complexityMax !== 5
  ));

  const cartBookIds = useMemo(
    () => cart.map((item) => item.bookId).sort().join(","),
    [cart],
  );
  const favoriteBookIds = useMemo(
    () => [...favorites].sort().join(","),
    [favorites],
  );
  const preferencesKey = useMemo(
    () => preferences ? JSON.stringify(preferences) : "no-preferences",
    [preferences],
  );

  const loadRecommendations = useCallback(async () => {
    if (authLoading) return;

    setLoading(true);
    setError(null);

    try {
      const nextItems = await getRecommendations(RECOMMENDATION_LIMIT);
      setItems(nextItems);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось сформировать рекомендации";
      setError(message);
      setItems([]);
      if (import.meta.env.DEV) {
        console.error("[Интеллекта][recommendations] load:error", { message });
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations, favoriteBookIds, cartBookIds, preferencesKey, isAuthenticated]);

  const openRecommendation = (book: Book, index: number) => {
    void logRecommendationClick(book.id, `stage19:${index + 1}:${Math.round((items[index]?.score ?? 0) * 100)}`);
    navigate(`/book/${book.slug || book.id}`);
  };

  return (
    <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 md:py-10 fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <SectionTitle sub="Подборка строится по профилю, избранному, корзине, заказам, событиям пользователя и ИИ-признакам книг.">
          Персональные рекомендации
        </SectionTitle>
        <GhostButton onClick={loadRecommendations} disabled={loading}>
          <RefreshCcw size={16} /> Обновить
        </GhostButton>
      </div>

      {!aiAvailable && (
        <div className="mb-5">
          <Notice tone="warn" title="ИИ-профили временно недоступны">
            Используем жанры, рейтинг и доступные данные каталога. После восстановления ИИ-профилей рекомендации станут точнее.
          </Notice>
        </div>
      )}

      {!isAuthenticated && !authLoading && (
        <div className="mb-6">
          <Notice tone="info" title="Гостевой режим">
            Сейчас показаны неперсональные популярные книги. Войдите и заполните профиль, чтобы получить рекомендации по вашим темам, избранному и истории действий.
          </Notice>
        </div>
      )}

      {isAuthenticated && !hasPrefs && !loading && (
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
                Заполните профиль для более точной подборки
              </h2>
              <p style={{ color: BRAND.slate, marginTop: 6, lineHeight: 1.6 }}>
                Даже без профиля мы учитываем избранное, корзину, заказы и события, но темы и цели чтения дают лучшие explanations.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <PrimaryButton onClick={() => navigate("/preferences")}>
                  <Settings2 size={16} /> Заполнить предпочтения
                </PrimaryButton>
                <GhostButton onClick={() => navigate("/catalog")}>Вернуться в каталог</GhostButton>
              </div>
            </div>
          </div>
        </section>
      )}

      {loading && (
        <section className="space-y-4" aria-busy="true" aria-live="polite">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </section>
      )}

      {!loading && error && (
        <EmptyState
          title="Не удалось сформировать рекомендации"
          text={error}
          icon={<Sparkles size={22} />}
          action={(
            <>
              <PrimaryButton onClick={loadRecommendations}>Повторить</PrimaryButton>
              <GhostButton onClick={() => navigate("/catalog")}>Открыть каталог</GhostButton>
            </>
          )}
        />
      )}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="Рекомендаций пока нет"
          text="Добавьте книги в избранное, заполните предпочтения или посмотрите несколько карточек — после этого подборка станет доступна."
          icon={<Sparkles size={22} />}
          action={(
            <>
              <PrimaryButton onClick={() => navigate("/preferences")}>Заполнить предпочтения</PrimaryButton>
              <GhostButton onClick={() => navigate("/catalog")}>Перейти в каталог</GhostButton>
            </>
          )}
        />
      )}

      {!loading && !error && items.length > 0 && (
        <section className="mb-10">
          <SectionTitle sub="Каждая карточка содержит score и причины, по которым книга попала в подборку.">
            {isAuthenticated ? "Подобрано для вас" : "Популярное для начала"}
          </SectionTitle>
          <div className="space-y-4">
            {items.map((item, index) => (
              <RecommendationRow
                key={item.book.id}
                item={item}
                index={index}
                isFav={favorites.includes(item.book.id)}
                favoriteDisabled={favoritePendingIds.includes(item.book.id)}
                cartDisabled={cartPendingBookIds.includes(item.book.id)}
                onOpen={() => openRecommendation(item.book, index)}
                onToggleFav={() => toggleFav(item.book.id)}
                onAddToCart={() => addToCart(item.book.id)}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function RecommendationRow({
  item,
  index,
  isFav,
  favoriteDisabled,
  cartDisabled,
  onOpen,
  onToggleFav,
  onAddToCart,
}: {
  item: RecommendationItem;
  index: number;
  isFav: boolean;
  favoriteDisabled?: boolean;
  cartDisabled?: boolean;
  onOpen: () => void;
  onToggleFav: () => void;
  onAddToCart: () => void;
}) {
  const book = item.book;
  const unavailable = !book.isActive || book.inStock <= 0;

  return (
    <article
      className="rounded-xl border p-4 md:p-5 grid gap-4 sm:grid-cols-[120px_1fr]"
      style={{ background: "white", borderColor: BRAND.beige, boxShadow: "0 1px 3px rgba(26,43,60,0.04)" }}
    >
      <button
        onClick={onOpen}
        className="rounded-md overflow-hidden mx-auto sm:mx-0"
        style={{ width: 120, height: 170, background: BRAND.beige }}
        aria-label={`Открыть «${book.title}»`}
      >
        <ImageWithFallback src={book.coverUrl} alt={`Обложка книги «${book.title}»`} className="w-full h-full object-cover" />
      </button>
      <div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <button onClick={onOpen} className="text-left">
              <div style={{ color: BRAND.slate, fontSize: 12, marginBottom: 4 }}>#{index + 1} в подборке</div>
              <h3 className="font-serif" style={{ color: BRAND.navy, fontSize: 20, lineHeight: 1.2 }}>
                {book.title}
              </h3>
              <div style={{ color: BRAND.slate, fontSize: 14 }}>{book.authors.join(", ")}</div>
            </button>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <ScoreBadge score={item.score} />
            <div style={{ color: BRAND.charcoal }}>{book.price} ₽</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {book.topics.slice(0, 4).map((topic) => (
            <SemanticBadge key={topic}>{topic}</SemanticBadge>
          ))}
        </div>

        <ul
          className="mt-3 grid gap-1"
          style={{ color: BRAND.charcoal, fontSize: 14 }}
          aria-label="Причины рекомендации"
        >
          {item.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2">
              <ChevronRight size={14} style={{ color: BRAND.slate, marginTop: 3, flexShrink: 0 }} />
              {reason}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton onClick={onAddToCart} disabled={unavailable || cartDisabled}>
            <ShoppingCart size={14} /> {unavailable ? "Недоступно" : "В корзину"}
          </PrimaryButton>
          <GhostButton onClick={onToggleFav} disabled={favoriteDisabled}>
            <Heart size={14} fill={isFav ? BRAND.navy : "none"} />
            {isFav ? "В избранном" : "В избранное"}
          </GhostButton>
          <GhostButton onClick={onOpen}>Подробнее</GhostButton>
        </div>
      </div>
    </article>
  );
}
