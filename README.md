# Интеллекта

«Интеллекта» — MVP веб-сервиса онлайн-продажи книг с использованием искусственного интеллекта для семантического анализа описаний книг и формирования персонализированных рекомендаций.

Текущая реализация не содержит отдельного классического backend API с префиксом `/api/v1`. Frontend работает с Supabase напрямую через Supabase JavaScript Client и сервисные модули, а ИИ-анализ книги выполняется через Vercel Function `POST /api/analyze-book`.

## Фактический стек

- Frontend: React 18, Vite 6, TypeScript, React Router.
- Размещение frontend: Vercel.
- Backend/data layer: Supabase.
- База данных: Supabase PostgreSQL.
- Авторизация: Supabase Auth.
- Разграничение доступа: Supabase Row Level Security.
- Серверная логика: Supabase RPC/functions и Vercel Serverless Function.
- Хранилище обложек: Supabase Storage bucket `book-covers`.
- ИИ-провайдер: OpenRouter API, вызывается только server-side из Vercel Functions `/api/analyze-book` и `/api/semantic-search`.
- Package manager: npm.
- Node.js: версия 20 и выше.

## Архитектура взаимодействия

Клиентское приложение размещается на Vercel и выполняется как React/Vite SPA. Для работы с данными frontend использует `src/lib/supabase.ts` и сервисные модули в `src/services`.

Основные операции выполняются так:

- авторизация — `supabase.auth.signUp`, `signInWithPassword`, `signOut`, `getSession`, `getUser`;
- каталог — чтение `public.book_catalog_view` через Supabase client;
- профиль предпочтений — чтение/`upsert` таблицы `public.user_preferences`;
- избранное — таблица `public.favorites`;
- корзина — таблица `public.cart_items`;
- оформление заказа — RPC `public.create_order_from_cart(...)`;
- изменение статуса заказа администратором — RPC `public.admin_update_order_status(...)`;
- административный CRUD книг — RPC `admin_get_books`, `admin_get_book`, `admin_create_book`, `admin_update_book`, `admin_soft_delete_book`, `admin_restore_book`;
- ИИ-анализ книги — Vercel Function `POST /api/analyze-book`;
- смысловой поиск — Vercel Function `POST /api/semantic-search`, OpenRouter embeddings и RPC `public.match_books_semantic(...)`;
- журнал ИИ-задач — таблица `public.ai_analysis_jobs`;
- результаты ИИ-анализа — таблица `public.book_ai_profiles`.

`/api/analyze-book` проверяет Supabase access token текущего пользователя, сверяет роль `admin` в `public.profiles`, создает запись в `ai_analysis_jobs`, вызывает OpenRouter или локальный fallback-анализ и сохраняет результат в `book_ai_profiles`. Приватные ключи OpenRouter и Supabase service role key не используются во frontend.

## Структура проекта

```text
.
├── api/
│   ├── analyze-book.ts              # Vercel Function для ИИ-анализа книги
│   ├── semantic-search.ts           # Vercel Function для смыслового поиска
│   └── _semantic.ts                 # server-side utilities для embeddings
├── docs/                            # DOCX-документация проекта
├── src/
│   ├── app/
│   │   ├── auth/                    # React AuthContext
│   │   ├── components/              # страницы и UI-компоненты
│   │   └── routes.tsx               # маршруты приложения
│   ├── lib/
│   │   ├── supabase.ts              # создание Supabase client
│   │   └── supabaseHealth.ts
│   ├── services/                    # прикладные сервисы доступа к Supabase/RPC
│   └── styles/
├── scripts/                         # служебные локальные scripts
│   └── backfill-book-embeddings.mjs # backfill embedding для существующих книг
├── supabase/sql/                    # SQL-миграции, RLS, RPC и проверки
├── .env.example                     # шаблон переменных окружения без секретов
├── package.json
├── package-lock.json
├── vercel.json                      # SPA routing для Vercel
└── vite.config.ts
```

## Основные маршруты приложения

- `/` — главная страница.
- `/catalog` — каталог книг.
- `/search` — поиск по каталогу и смысловым признакам MVP.
- `/book/:bookId` — карточка книги.
- `/login` — вход.
- `/register` — регистрация.
- `/preferences` — профиль предпочтений пользователя.
- `/recommendations` — персональные рекомендации.
- `/favorites` — избранное.
- `/cart` — корзина.
- `/checkout` — оформление заказа.
- `/orders` — история заказов.
- `/admin` — административная панель для роли `admin`.

## Переменные окружения

В репозиторий коммитится только `.env.example`. Для локального запуска создайте `.env.local` и заполните значения.

Публичные переменные frontend:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Server-only переменные для Vercel Function:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
EMBEDDING_DIMENSION=1536
APP_URL=
VERCEL_URL=
VERCEL_PROJECT_PRODUCTION_URL=
```

Правила безопасности:

- `.env`, `.env.local` и реальные ключи не коммитятся;
- `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `DATABASE_URL` и другие приватные значения нельзя читать из frontend-кода;
- во frontend допустимы только переменные с префиксами `VITE_` и `NEXT_PUBLIC_`;
- `vite.config.ts` намеренно не раскрывает переменные с префиксом `SUPABASE_`;
- production-переменные задаются в Vercel Project Settings → Environment Variables.

## Локальный запуск

1. Установите Node.js 20+.
2. Откройте папку проекта.
3. Создайте `.env.local` на основе `.env.example`.
4. Установите зависимости:

```bash
npm install
```

5. Запустите dev-сервер:

```bash
npm run dev
```

6. Перед публикацией проверьте сборку:

```bash
npm run build
```

7. При необходимости проверьте production build локально:

```bash
npm run preview
```

В текущем `package.json` нет отдельных скриптов `lint` и `test`; если они будут добавлены на следующих этапах, их нужно включить в процедуру проверки.

## Семантический поиск

Этап 2 реализует настоящий смысловой поиск через embedding-представления и pgvector. Обычный текстовый поиск в каталоге сохранен и используется как fallback, но основной режим `/search?mode=semantic` работает так:

1. Книга получает embedding после запуска `POST /api/analyze-book` или после локального backfill-скрипта `npm run semantic:backfill`.
2. Текст для embedding книги формируется из названия, авторов, жанров, описания, ИИ-сводки, тем, ключевых слов, сложности и эмоционального тона.
3. Embedding хранится в `public.book_ai_profiles.embedding` как `vector(1536)`. Служебные поля: `embedding_model`, `embedding_dimension`, `embedding_updated_at`, `embedding_status`, `embedding_error`.
4. Пользовательский запрос отправляется из frontend в Vercel Function `POST /api/semantic-search`.
5. Функция получает embedding запроса через OpenRouter embeddings API и вызывает Supabase RPC `public.match_books_semantic(...)`.
6. PostgreSQL/pgvector считает cosine similarity: `1 - (book_embedding <=> query_embedding)`.
7. Frontend показывает карточки книг, процент совпадения и причины подбора.

Используемая embedding-модель по умолчанию:

```env
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
EMBEDDING_DIMENSION=1536
```

Размерность `EMBEDDING_DIMENSION` должна совпадать с типом колонки `book_ai_profiles.embedding` и сигнатурой RPC `match_books_semantic`. Для текущего MVP миграция `22_semantic_search_pgvector.sql` использует `vector(1536)`.

### Backfill embedding для существующих книг

Перед запуском убедитесь, что в `.env.local` есть server-only переменные:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
EMBEDDING_DIMENSION=1536
```

Запуск небольшой партии:

```bash
npm run semantic:backfill -- --limit=20
```

Повторная принудительная генерация существующих embedding:

```bash
npm run semantic:backfill -- --limit=20 --force
```

Скрипт не коммитит секреты, не удаляет существующие embedding без `--force`, не падает на первой ошибке и выводит отчет по обработанным книгам.

### Проверка semantic search

1. Примените SQL-миграцию `supabase/sql/22_semantic_search_pgvector.sql`.
2. Заполните embedding через админский ИИ-анализ книги или `npm run semantic:backfill -- --limit=20`.
3. Запустите приложение: `npm run dev`.
4. Откройте `/catalog`, включите флажок «Искать по смыслу» или перейдите на `/search`.
5. Введите запрос: `книга о самоопределении в цифровом обществе`.
6. В результатах должны отображаться книги, отсортированные по смысловой близости, с показателем совпадения и причинами подбора.

Если OpenRouter embeddings или RPC недоступны, `/api/semantic-search` возвращает fallback-режим: «Смысловой поиск временно недоступен, показаны результаты обычного поиска».

## Supabase setup

SQL-скрипты находятся в `supabase/sql`. Их следует применять через Supabase SQL Editor в порядке, описанном в `supabase/sql/README.md`.

Ключевые элементы схемы:

- `profiles` — публичные профили пользователей, роль `user`/`admin`;
- `books`, `authors`, `genres`, `book_authors`, `book_genres` — каталог;
- `book_catalog_view` — агрегированное представление каталога для frontend;
- `user_preferences` — предпочтения читателя;
- `favorites` — избранное;
- `cart_items` — корзина;
- `orders`, `order_items` — заказы и snapshot позиций;
- `book_ai_profiles` — результаты ИИ-анализа и embedding-векторы книг для semantic search;
- `ai_analysis_jobs` — журнал запусков ИИ-анализа;
- `user_events` — события просмотра, поиска, покупок и рекомендаций;
- `match_books_semantic(...)` — RPC для поиска книг по cosine similarity через pgvector;
- `reviews` — таблица отзывов, предусмотренная схемой для дальнейшего развития сценария.

RLS-политики должны запрещать пользователю доступ к чужим предпочтениям, избранному, корзине, заказам и событиям. Административные операции выполняются через RPC и проверку роли `admin`.

## Проверка основных сценариев

После настройки Supabase и переменных окружения проверьте:

1. Открытие главной страницы и каталога.
2. Открытие карточки книги.
3. Регистрацию или вход пользователя.
4. Сохранение предпочтений.
5. Добавление книги в избранное.
6. Добавление книги в корзину и изменение количества.
7. Оформление заказа через checkout.
8. Просмотр истории своих заказов.
9. Вход под администратором и открытие `/admin`.
10. Создание/редактирование/скрытие книги через админ-панель.
11. Запуск ИИ-анализа книги из админ-панели.
12. Проверку сохранения результата в `book_ai_profiles`, включая `embedding`, `embedding_model`, `embedding_updated_at`, и задачи в `ai_analysis_jobs`.
13. Проверку смыслового поиска через `/search` и Vercel Function `/api/semantic-search`.
14. Проверку, что обычный пользователь не видит чужие заказы, корзину, избранное и админ-панель.

## Что не реализовано как отдельный слой

В текущей версии не реализованы и не должны описываться как фактические компоненты:

- отдельный backend API `/api/v1`;
- backend на FastAPI или Express;
- Redis/Celery/BullMQ-очередь и отдельный worker;
- Docker Compose как production-способ запуска;
- Prometheus/Grafana как реализованный мониторинг;

Эти пункты могут рассматриваться как направления развития после MVP.
