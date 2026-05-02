import { BRAND } from "./brand";

export function Footer() {
  return (
    <footer className="mt-16 border-t" style={{ borderColor: BRAND.beige, background: BRAND.cream }}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-10 grid gap-8 md:grid-cols-4 text-sm" style={{ color: BRAND.slate }}>
        <div>
          <div className="font-serif tracking-[0.18em] mb-3" style={{ color: BRAND.navy, fontSize: 16, fontWeight: 600 }}>
            ИНТЕЛЛЕКТА
          </div>
          <p style={{ lineHeight: 1.6 }}>
            Интеллектуальный книжный магазин. Помогаем выбирать книги осознанно
            с помощью смыслового поиска и объяснимых рекомендаций.
          </p>
        </div>
        <div>
          <div style={{ color: BRAND.navy, marginBottom: 8 }}>Магазин</div>
          <ul className="space-y-2">
            <li>Каталог</li>
            <li>Жанры</li>
            <li>Подборки</li>
            <li>Новинки</li>
          </ul>
        </div>
        <div>
          <div style={{ color: BRAND.navy, marginBottom: 8 }}>О нас</div>
          <ul className="space-y-2">
            <li>Концепция</li>
            <li>Как работает ИИ-анализ</li>
            <li>Контакты</li>
          </ul>
        </div>
        <div>
          <div style={{ color: BRAND.navy, marginBottom: 8 }}>Поддержка</div>
          <ul className="space-y-2">
            <li>Доставка</li>
            <li>Возврат</li>
            <li>FAQ</li>
          </ul>
        </div>
      </div>
      <div className="border-t" style={{ borderColor: BRAND.beige }}>
        <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-4 text-xs" style={{ color: BRAND.gray }}>
          © 2026 Интеллекта. ИИ-подсказки носят вспомогательный характер и не
          заменяют официальные описания книг.
        </div>
      </div>
    </footer>
  );
}
