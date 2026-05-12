import { Heart, ShoppingCart, Star, Sparkles, ChevronRight } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { BRAND } from "./brand";
import type { Book, Complexity } from "./types";

export function SemanticBadge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "match";
}) {
  const styles =
    tone === "match"
      ? { background: "#E4ECF3", color: BRAND.navy, border: `1px solid #C9D6E2` }
      : { background: BRAND.beige, color: BRAND.darkSlate, border: "1px solid transparent" };
  return (
    <span
      className="inline-block rounded-full"
      style={{
        ...styles,
        padding: "3px 10px",
        fontSize: 12,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function FormatBadge({ format }: { format: string }) {
  return (
    <span
      className="inline-block rounded"
      style={{
        background: "rgba(255,255,255,0.92)",
        border: `1px solid ${BRAND.lightGray}`,
        color: BRAND.slate,
        padding: "1px 8px",
        fontSize: 11,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {format}
    </span>
  );
}

export function AvailabilityBadge({ inStock, isActive }: { inStock: number; isActive: boolean }) {
  if (!isActive) {
    return <StatusBadge status="Скрыта" tone="neutral" />;
  }
  if (inStock <= 0) {
    return <StatusBadge status="Нет в наличии" tone="err" />;
  }
  if (inStock < 5) {
    return <StatusBadge status={`Осталось ${inStock}`} tone="warn" />;
  }
  return <StatusBadge status="В наличии" tone="ok" />;
}

export function StatusBadge({
  status,
  tone = "neutral",
}: {
  status: string;
  tone?: "neutral" | "ok" | "warn" | "err" | "info";
}) {
  const map: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: BRAND.beige, fg: BRAND.darkSlate },
    ok: { bg: "#E5EFE6", fg: "#2E5E37" },
    warn: { bg: "#F5EBD7", fg: "#6B4E12" },
    err: { bg: "#F2DDDD", fg: "#8C2A2A" },
    info: { bg: "#DCE6F0", fg: BRAND.navy },
  };
  const c = map[tone];
  return (
    <span
      className="inline-flex items-center rounded-full"
      style={{
        background: c.bg,
        color: c.fg,
        padding: "2px 10px",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      <span
        className="rounded-full mr-1.5"
        style={{ width: 6, height: 6, background: c.fg, opacity: 0.7 }}
        aria-hidden
      />
      {status}
    </span>
  );
}

export function ComplexityScale({ level }: { level: Complexity }) {
  const order: Complexity[] = ["Лёгкий", "Средний", "Сложный", "Профессиональный"];
  const idx = order.indexOf(level);
  return (
    <div className="inline-flex items-center gap-2" aria-label={`Уровень сложности: ${level}`}>
      <div className="flex items-center gap-1" aria-hidden>
        {order.map((_, i) => (
          <span
            key={i}
            style={{
              width: 22,
              height: 4,
              borderRadius: 2,
              background: i <= idx ? BRAND.navy : BRAND.beige,
              display: "inline-block",
            }}
          />
        ))}
      </div>
      <span style={{ color: BRAND.charcoal, fontSize: 13 }}>{level}</span>
    </div>
  );
}

interface BookCardProps {
  book: Book;
  isFav: boolean;
  favoriteDisabled?: boolean;
  onToggleFav: () => void;
  onAddToCart: () => void;
  onOpen: () => void;
  variant?: "grid" | "list";
  reasons?: string[];
  score?: number;
  matched?: string[];
  semanticHint?: boolean;
}

export function BookCard({
  book, isFav, favoriteDisabled = false, onToggleFav, onAddToCart, onOpen,
  variant = "grid", reasons, score, matched, semanticHint,
}: BookCardProps) {
  const unavailable = !book.isActive || book.inStock <= 0;
  const matchedSet = new Set(matched ?? []);

  if (variant === "list") {
    return (
      <article
        className="book-card rounded-xl border p-4 flex gap-4"
        style={{ background: "white", borderColor: BRAND.beige, boxShadow: "0 1px 3px rgba(26,43,60,0.04)" }}
      >
        <button
          onClick={onOpen}
          className="shrink-0 rounded-md overflow-hidden"
          style={{ width: 96, height: 140, background: BRAND.beige }}
          aria-label={`Открыть книгу «${book.title}»`}
        >
          <ImageWithFallback src={book.coverUrl} alt={`Обложка книги «${book.title}»`} className="w-full h-full object-cover" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <button onClick={onOpen} className="text-left min-w-0">
              <h3 className="font-serif" style={{ color: BRAND.navy, fontSize: 18, lineHeight: 1.25 }}>
                {book.title}
              </h3>
              <div style={{ color: BRAND.slate, fontSize: 13, marginTop: 2 }}>
                {book.authors.join(", ")}
              </div>
            </button>
            {typeof score === "number" && (
              <ScoreBadge score={score} />
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {book.topics.slice(0, 3).map((t) => (
              <SemanticBadge key={t} tone={matchedSet.has(t) ? "match" : "default"}>{t}</SemanticBadge>
            ))}
            <FormatBadge format={book.format} />
            <AvailabilityBadge inStock={book.inStock} isActive={book.isActive} />
          </div>
          {semanticHint && (
            <div className="mt-2 inline-flex items-center gap-1.5" style={{ color: BRAND.slate, fontSize: 12 }}>
              <Sparkles size={12} /> Найдено по смыслу
            </div>
          )}
          <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
            <div className="flex items-center gap-3" style={{ color: BRAND.charcoal }}>
              <span style={{ fontSize: 18 }}>{book.price} ₽</span>
              <span style={{ color: BRAND.gray, fontSize: 13 }}>
                <Star size={12} style={{ display: "inline", marginRight: 4 }} />
                {book.rating.toFixed(1)}
              </span>
            </div>
            <CardActions
              isFav={isFav}
              onToggleFav={onToggleFav}
              favoriteDisabled={favoriteDisabled}
              onAddToCart={onAddToCart}
              onOpen={onOpen}
              unavailable={unavailable}
            />
          </div>
          {reasons && reasons.length > 0 && (
            <ReasonsBlock reasons={reasons} />
          )}
        </div>
      </article>
    );
  }

  return (
    <article
      className="book-card rounded-xl border overflow-hidden flex flex-col h-full"
      style={{ background: "white", borderColor: BRAND.beige, boxShadow: "0 1px 3px rgba(26,43,60,0.04)" }}
    >
      <button
        onClick={onOpen}
        className="block relative"
        style={{ aspectRatio: "3 / 4", background: BRAND.beige }}
        aria-label={`Открыть книгу «${book.title}»`}
      >
        <ImageWithFallback
          src={book.coverUrl}
          alt={`Обложка книги «${book.title}»`}
          className="w-full h-full object-cover"
        />
        <span className="absolute top-2 left-2 flex flex-col gap-1 items-start">
          <FormatBadge format={book.format} />
          {!book.isActive || book.inStock <= 0 ? (
            <AvailabilityBadge inStock={book.inStock} isActive={book.isActive} />
          ) : null}
        </span>
        {typeof score === "number" && (
          <span className="absolute bottom-2 left-2"><ScoreBadge score={score} /></span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); if (!favoriteDisabled) onToggleFav(); }}
          disabled={favoriteDisabled}
          aria-pressed={isFav}
          aria-label={isFav ? "Убрать из избранного" : "Добавить в избранное"}
          className="absolute top-2 right-2 rounded-full p-2"
          style={{
            background: "white",
            color: isFav ? BRAND.navy : BRAND.slate,
            cursor: favoriteDisabled ? "not-allowed" : "pointer",
            opacity: favoriteDisabled ? 0.7 : 1,
            boxShadow: "0 2px 6px rgba(26,43,60,0.10)",
          }}
        >
          <Heart size={16} fill={isFav ? BRAND.navy : "none"} />
        </button>
      </button>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <button onClick={onOpen} className="text-left">
          <h3 className="font-serif" style={{ color: BRAND.navy, fontSize: 16, lineHeight: 1.3 }}>
            {book.title}
          </h3>
          <div style={{ color: BRAND.slate, fontSize: 13, marginTop: 2 }}>
            {book.authors.join(", ")}
          </div>
        </button>
        <div className="flex flex-wrap gap-1 mt-1">
          {book.topics.slice(0, 3).map((t) => (
            <SemanticBadge key={t} tone={matchedSet.has(t) ? "match" : "default"}>{t}</SemanticBadge>
          ))}
        </div>
        {semanticHint && (
          <div className="inline-flex items-center gap-1.5 mt-1" style={{ color: BRAND.slate, fontSize: 12 }}>
            <Sparkles size={12} /> Найдено по смыслу
          </div>
        )}
        <div className="flex items-center justify-between mt-auto pt-3 gap-2">
          <div>
            <div style={{ color: BRAND.charcoal, fontSize: 16 }}>{book.price} ₽</div>
            <div style={{ color: BRAND.gray, fontSize: 12 }}>
              <Star size={11} style={{ display: "inline", marginRight: 3 }} />
              {book.rating.toFixed(1)} · {book.reviewsCount}
            </div>
          </div>
          <button
            onClick={onAddToCart}
            disabled={unavailable}
            aria-label="Добавить в корзину"
            className="rounded-md px-3 py-2 inline-flex items-center gap-2 shrink-0"
            style={{
              background: unavailable ? BRAND.lightGray : BRAND.navy,
              color: "white",
              cursor: unavailable ? "not-allowed" : "pointer",
              fontSize: 13,
            }}
          >
            <ShoppingCart size={14} />
            {unavailable ? "Нет" : "В корзину"}
          </button>
        </div>
        <button
          onClick={onOpen}
          className="text-left mt-1"
          style={{ color: BRAND.slate, fontSize: 13 }}
        >
          Подробнее →
        </button>
        {reasons && reasons.length > 0 && (
          <ReasonsBlock reasons={reasons} />
        )}
      </div>
    </article>
  );
}

function CardActions({
  isFav, favoriteDisabled, onToggleFav, onAddToCart, onOpen, unavailable,
}: {
  isFav: boolean; favoriteDisabled?: boolean; onToggleFav: () => void; onAddToCart: () => void; onOpen: () => void; unavailable: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={onOpen}
        className="rounded-md px-3 py-2 border"
        style={{ borderColor: BRAND.lightGray, color: BRAND.navy, background: "white", fontSize: 13 }}
      >
        Подробнее
      </button>
      <button
        onClick={onToggleFav}
        disabled={favoriteDisabled}
        aria-pressed={isFav}
        aria-label={isFav ? "Убрать из избранного" : "Добавить в избранное"}
        className="p-2 rounded-md border"
        style={{
          borderColor: isFav ? BRAND.navy : BRAND.lightGray,
          background: isFav ? BRAND.navy : "white",
          color: isFav ? "white" : BRAND.slate,
          cursor: favoriteDisabled ? "not-allowed" : "pointer",
          opacity: favoriteDisabled ? 0.7 : 1,
        }}
      >
        <Heart size={16} fill={isFav ? "white" : "none"} />
      </button>
      <button
        onClick={onAddToCart}
        disabled={unavailable}
        className="px-3 py-2 rounded-md inline-flex items-center gap-2"
        style={{
          background: unavailable ? BRAND.lightGray : BRAND.navy,
          color: "white",
          cursor: unavailable ? "not-allowed" : "pointer",
          fontSize: 14,
        }}
      >
        <ShoppingCart size={14} />
        {unavailable ? "Недоступно" : "В корзину"}
      </button>
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full"
      style={{
        background: "rgba(255,255,255,0.95)",
        border: `1px solid ${BRAND.beige}`,
        color: BRAND.navy,
        padding: "2px 8px",
        fontSize: 11,
        letterSpacing: "0.02em",
      }}
      aria-label={`Релевантность ${Math.round(score * 100)} процентов`}
    >
      <Sparkles size={11} /> {Math.round(score * 100)}%
    </span>
  );
}

export function ReasonsBlock({ reasons }: { reasons: string[] }) {
  return (
    <div
      className="mt-3 rounded-md p-3"
      style={{ background: "#F4F1EB", border: `1px dashed ${BRAND.beige}` }}
    >
      <div
        className="inline-flex items-center gap-1.5 mb-1.5"
        style={{ color: BRAND.darkSlate, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}
      >
        <Sparkles size={12} /> Почему вам подходит
      </div>
      <ul className="space-y-1" style={{ color: BRAND.charcoal, fontSize: 13 }}>
        {reasons.map((r) => (
          <li key={r} className="flex items-start gap-1.5">
            <ChevronRight size={13} style={{ color: BRAND.slate, marginTop: 2, flexShrink: 0 }} />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PrimaryButton({
  children, onClick, disabled, type, ariaLabel, full,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  ariaLabel?: string;
  full?: boolean;
}) {
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`rounded-md px-5 py-3 inline-flex items-center justify-center gap-2 ${full ? "w-full" : ""}`}
      style={{
        background: disabled ? BRAND.lightGray : BRAND.navy,
        color: "white",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.85 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children, onClick, full, ariaLabel, type, disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  full?: boolean;
  ariaLabel?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`rounded-md px-5 py-3 inline-flex items-center justify-center gap-2 border ${full ? "w-full" : ""}`}
      style={{
        background: "white",
        color: disabled ? BRAND.gray : BRAND.navy,
        borderColor: BRAND.lightGray,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.75 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-6">
      <h2 className="font-serif text-balance" style={{ color: BRAND.navy, fontSize: 28, lineHeight: 1.2 }}>
        {children}
      </h2>
      {sub && <p style={{ color: BRAND.slate, marginTop: 6, fontSize: 14 }}>{sub}</p>}
    </div>
  );
}

export function EmptyState({
  title, text, action, icon,
}: {
  title: string; text?: string; action?: React.ReactNode; icon?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-10 text-center"
      style={{ background: "white", borderColor: BRAND.beige }}
    >
      {icon && (
        <div
          className="mx-auto mb-3 rounded-full inline-flex items-center justify-center"
          style={{ width: 52, height: 52, background: BRAND.beige, color: BRAND.navy }}
          aria-hidden
        >
          {icon}
        </div>
      )}
      <div className="font-serif" style={{ color: BRAND.navy, fontSize: 20 }}>{title}</div>
      {text && <p style={{ color: BRAND.slate, marginTop: 8, lineHeight: 1.6, maxWidth: 460, marginInline: "auto" }}>{text}</p>}
      {action && <div className="mt-5 inline-flex flex-wrap gap-2 justify-center">{action}</div>}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "white", borderColor: BRAND.beige }}>
      <div style={{ aspectRatio: "3 / 4", background: BRAND.beige }} className="animate-pulse" />
      <div className="p-4 space-y-2">
        <div className="h-4 rounded animate-pulse" style={{ background: BRAND.beige }} />
        <div className="h-3 rounded animate-pulse w-2/3" style={{ background: BRAND.beige }} />
        <div className="h-3 rounded animate-pulse w-1/2" style={{ background: BRAND.beige }} />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="rounded-xl border p-4" style={{ background: "white", borderColor: BRAND.beige }}>
      <div className="h-4 rounded animate-pulse w-1/3 mb-2" style={{ background: BRAND.beige }} />
      <div className="h-3 rounded animate-pulse w-2/3" style={{ background: BRAND.beige }} />
    </div>
  );
}

export function Notice({
  tone = "info", children, title,
}: {
  tone?: "info" | "warn" | "err" | "ok"; children: React.ReactNode; title?: string;
}) {
  const map = {
    info: { bg: "#EEF2F7", fg: BRAND.navy, br: "#D8E2EC" },
    ok: { bg: "#E8F1E9", fg: "#2E5E37", br: "#CFE2D2" },
    warn: { bg: "#FBF3DF", fg: "#6B4E12", br: "#EBDDB6" },
    err: { bg: "#F8E3E3", fg: "#8C2A2A", br: "#ECC8C8" },
  } as const;
  const c = map[tone];
  return (
    <div
      className="rounded-md px-4 py-3 border"
      style={{ background: c.bg, color: c.fg, borderColor: c.br, fontSize: 14, lineHeight: 1.5 }}
      role={tone === "err" ? "alert" : "status"}
    >
      {title && <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>}
      {children}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav aria-label="Хлебные крошки" style={{ color: BRAND.slate, fontSize: 13 }}>
      <ol className="flex items-center gap-2 flex-wrap">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2">
            {it.onClick ? (
              <button onClick={it.onClick} style={{ color: BRAND.slate }}>
                {it.label}
              </button>
            ) : (
              <span style={{ color: BRAND.charcoal }}>{it.label}</span>
            )}
            {i < items.length - 1 && <span aria-hidden style={{ color: BRAND.lightGray }}>/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
