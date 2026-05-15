# Интеллекта

«Интеллекта» — frontend MVP дипломного проекта: веб-сервис онлайн-продажи книг с ИИ-анализом содержания, семантическим поиском и объяснимыми рекомендациями.

## Project stack

- React 18
- Vite 6
- TypeScript
- React Router
- Supabase JS client
- Supabase Auth / PostgreSQL / Storage
- Vercel для hosting и automatic deployment после push в GitHub
- npm как основной package manager
- Node.js >= 20 для совместимости с текущими версиями Supabase JS и React Router

На текущем этапе приложение работает как React/Vite SPA и обращается к Supabase напрямую из браузера через публичный anon key. Service role key во frontend запрещен.

## Current stage/status

Текущий этап: **Stage 17 — реальный AI-analysis lifecycle**.

Готово на предыдущих этапах:

- Supabase Auth для регистрации, входа, выхода и определения роли пользователя.
- Чтение публичного каталога через `public.book_catalog_view`.
- Поддержка Supabase Storage bucket `book-covers` для обложек.
- Vercel SPA routing через `vercel.json`.
- Stage 11: стабилизированы npm, lockfile, env, README и Vercel build setup.
- Stage 11A: базовый security/RLS hardening считается выполненным.

Готово на Stage 12:

- Admin CRUD книг выполняется через Supabase RPC, а не через mock/local state.
- Создание и редактирование книг сохраняет `books`, `book_authors`, `book_genres`.
- Скрытие и восстановление книг работает через `books.is_active`.
- Обложки загружаются/заменяются через bucket `book-covers`, public URL сохраняется в `books.cover_url`.
- При создании книги или изменении описания AI-профиль помечается как `stale` для повторного серверного ИИ-анализа.

Готово на Stage 13:

- Профиль предпочтений пользователя загружается из `public.user_preferences`.
- Сохранение preferences выполняется через Supabase `upsert` по `user_id`, а не только через React state.
- После reload и logout/login preferences остаются сохраненными.
- При смене аккаунта локальный user-specific state preferences очищается, чтобы не показывать данные прошлого пользователя.
- Добавлен service layer `preferencesService`.
- Добавлен SQL-скрипт для own-only RLS на `user_preferences`.

Готово на Stage 14:

- Избранное пользователя хранится в `public.favorites`, а не только в React state.
- Favorite IDs загружаются после входа пользователя и очищаются при logout/смене аккаунта.
- Каталог, карточка книги, главная, поиск и страница избранного используют общий Supabase-backed favorite state.
- Страница `/favorites` загружает активные книги через `book_catalog_view`; скрытые книги не показываются пользователю.
- Добавлен service layer `favoritesService`.
- Добавлен SQL-скрипт для own-only RLS на `favorites`.

Готово на Stage 15:

- Корзина пользователя хранится в `public.cart_items`, а не только в React state.
- Cart загружается после login, сохраняется после reload/logout/login и очищается при смене аккаунта.
- Каталог, карточка книги, header-счетчик, страница `/cart` и checkout-summary используют общий Supabase-backed cart state.
- Количество обновляется в Supabase, одна книга не дублируется в корзине благодаря unique constraint `user_id + book_id`.
- Total считается по актуальной цене книги, загруженной из `book_catalog_view`.
- Неактивные/отсутствующие книги отображаются как недоступные, а переход к оформлению блокируется.
- Добавлен service layer `cartService`.
- Добавлен SQL-скрипт для own-only RLS на `cart_items`.

Готово на Stage 16:

- Оформление заказа выполняется через Supabase RPC `create_order_from_cart`, а не через frontend insert.
- RPC берет корзину текущего пользователя из `public.cart_items`, проверяет активность книг и остатки, пересчитывает `total_amount` на стороне БД.
- `public.orders` получает заказ со статусом `created`, способом получения, контактами и комментарием.
- `public.order_items` получает snapshot названия, цены и количества каждой книги.
- После успешного заказа корзина пользователя очищается.
- `/orders` загружает историю заказов из Supabase и показывает только заказы текущего пользователя по RLS.
- Вкладка `/admin → Заказы` загружает все заказы для admin и меняет статус через RPC `admin_update_order_status`.
- Прямые INSERT/UPDATE/DELETE для `orders` и `order_items` не выдаются frontend-роли, чтобы пользователь не мог подменить сумму или статус.


Готово на Stage 17:

- Добавлена серверная функция `api/analyze-book.ts` для запуска ИИ-анализа без раскрытия service role key и AI API keys во frontend.
- Admin запускает анализ из `/admin → ИИ-анализ`; frontend отправляет только Supabase session token.
- Функция проверяет admin-роль через `public.profiles.role = 'admin'`.
- Создается запись в `public.ai_analysis_jobs` со статусом `running`, затем `ready` или `failed`.
- Результат сохраняется в `public.book_ai_profiles`: `summary`, `topics`, `keywords`, `complexity_level`, `emotional_tone`, `embedding`, `status`.
- Если `OPENROUTER_API_KEY` не задан или OpenRouter недоступен, используется серверный MVP fallback-анализ: summary из описания, темы/keywords из жанров и текста, complexity/tone по эвристикам, embedding = `null`.
- RLS для `book_ai_profiles` и `ai_analysis_jobs` переведен в read-only режим для browser clients; прямые insert/update/delete из frontend запрещены.

Пока не переносится в рамках Stage 17:

- Полноценные рекомендации из Supabase.
- User events.
- pgvector/semantic search.

## Local development in VS Code

1. Откройте папку проекта в VS Code.
2. Используйте Node.js 20+ (`.nvmrc` содержит `20`).
3. Создайте `.env.local` на основе `.env.example`.
4. Установите зависимости:

```bash
npm install
```

5. Запустите dev-сервер:

```bash
npm run dev
```

6. Откройте локальный URL из терминала Vite.
7. Перед push проверьте production build:

```bash
npm run build
```

8. При необходимости проверьте production build локально:

```bash
npm run preview
```

## Environment variables

В репозитории должен коммититься только `.env.example`. Реальный `.env.local` не коммитится.

Минимальные переменные для frontend:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Дополнительно поддерживаются публичные переменные Vercel/Supabase Integration:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Правила безопасности:

- `.env.local` не коммитится.
- `.env.example` коммитится.
- Production env-переменные задаются в **Vercel Project Settings → Environment Variables**.
- После изменения env-переменных в Vercel нужен redeploy.
- Во frontend разрешен только публичный Supabase URL и public/anon key.
- `SUPABASE_SERVICE_ROLE_KEY` нельзя использовать во frontend или client-side variables. Для Stage 17 он задается только как server-side переменная Vercel Function без `VITE_`/`NEXT_PUBLIC_` prefix.
- `DATABASE_URL`, private OpenRouter/API keys и другие server-side secrets нельзя добавлять в браузерный bundle.

## Supabase setup

Supabase используется для Auth, PostgreSQL и Storage.

Frontend читает переменные в таком порядке:

1. `VITE_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_URL`
3. `VITE_SUPABASE_ANON_KEY`
4. `VITE_SUPABASE_PUBLISHABLE_KEY`
5. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Vite настроен на env prefixes:

```text
VITE_
NEXT_PUBLIC_
```

Не добавляйте prefix `SUPABASE_` в `vite.config.ts`, чтобы случайно не раскрыть server-side secrets.

### Storage для обложек

- Bucket: `book-covers`.
- Public read разрешен для витринных изображений.
- Upload/update/delete разрешаются только admin-пользователю через Supabase session и policies.
- Поддерживаемые форматы: JPG, PNG, WebP.
- Максимальный размер файла на frontend: 5 MB.
- После загрузки public URL должен сохраняться в `public.books.cover_url`.

### Stage 13 — User preferences in Supabase

Preferences пользователя хранятся в таблице `public.user_preferences`. Frontend использует только Supabase anon key и RLS; service role key не нужен и запрещен.

Сохраняемые поля:

- `user_id` — `auth.uid()` текущего пользователя;
- `genres` — JSON-массив выбранных жанров;
- `topics` — JSON-массив тем;
- `goals` — JSON-массив целей чтения;
- `complexity_min`;
- `complexity_max`;
- `excluded_genres` — JSON-массив исключенных жанров.

Frontend service:

- `getUserPreferences()`;
- `upsertUserPreferences(input)`;
- `resetUserPreferences()`;
- `hasUserPreferences()`;
- `normalizePreferences(row)`;
- `mapPreferencesToDb(input, userId)`.

RLS:

- пользователь может читать только `user_preferences.user_id = auth.uid()`;
- пользователь может insert/update/delete только свою строку;
- admin не получает отдельного права менять чужие личные preferences на этом этапе.

Проверка Stage 13:

1. Войти пользователем.
2. Открыть `/preferences`.
3. Заполнить жанры, темы, цели и сложность.
4. Нажать «Сохранить».
5. Перезагрузить страницу и снова открыть `/preferences`.
6. Выйти и войти снова — значения должны сохраниться.
7. Войти другим аккаунтом — preferences первого пользователя не должны отображаться.

Stage 14 переносит Favorites, а Stage 19 будет использовать preferences и favorites для рекомендаций из Supabase.

### Stage 14 — Favorites in Supabase

Избранное пользователя хранится в таблице `public.favorites`. Frontend использует только Supabase anon key и RLS; service role key не нужен и запрещен.

Сохраняемые поля:

- `user_id` — `auth.uid()` текущего пользователя;
- `book_id` — UUID книги из `public.books`;
- `created_at` — дата добавления.

Frontend service:

- `getFavorites()`;
- `getFavoriteBookIds()`;
- `getFavoriteBooks()`;
- `addFavorite(bookId)`;
- `removeFavorite(bookId)`;
- `isFavorite(bookId)`;
- `toggleFavorite(bookId)`;
- `clearFavorites()`;
- `normalizeFavoriteRow(row)`.

RLS:

- пользователь может читать только `favorites.user_id = auth.uid()`;
- пользователь может insert только свою строку;
- пользователь может delete только свою строку;
- guest не может создавать избранное;
- `primary key (user_id, book_id)` защищает от дублей.

Проверка Stage 14:

1. Войти пользователем.
2. Открыть `/catalog`.
3. Добавить книгу в избранное.
4. Открыть `/favorites` — книга должна отображаться.
5. Перезагрузить страницу — книга должна остаться.
6. Удалить книгу из избранного и снова перезагрузить страницу.
7. Войти другим аккаунтом — избранное первого пользователя не должно отображаться.
8. Выйти и нажать favorite в каталоге — приложение должно предложить войти.

Stage 15 переносит Cart в Supabase; Stage 19 будет использовать favorites и cart/orders-сигналы для рекомендаций из Supabase.

## SQL scripts order

SQL-скрипты находятся в `supabase/sql/` и применяются через **Supabase SQL Editor**.

Рекомендуемый порядок восстановления проекта:

0. `00_connection_check.sql` — необязательная проверка SQL Editor.
1. `01_schema.sql` — базовые таблицы, связи и начальная модель.
2. `02_indexes.sql` — индексы.
3. `03_triggers.sql` — `updated_at` и создание профиля после регистрации.
4. `04_rls_prepare.sql` — подготовка RLS и helper-функции.
5. `99_verify_schema.sql` — проверка базовой схемы.
6. `05_auth_roles.sql` — роли и auth/profile setup.
7. `07_auth_rls.sql` — RLS для `profiles` и `user_preferences`.
8. `06_set_admin_example.sql` — назначение первого администратора после регистрации пользователя.
9. `08_catalog_fixes.sql` — безопасные уточнения каталожной схемы.
10. `08_catalog_view_security.sql` — security-настройки для catalog view, если требуются текущей схемой.
11. `09_catalog_view.sql` — `public.book_catalog_view` для frontend-каталога.
12. `10_catalog_rls.sql` — RLS для каталожных таблиц.
13. `12_seed_catalog.sql` — демо-каталог, авторы, жанры и AI-профили.
14. `11_verify_catalog.sql` — проверка каталога.
15. `13_storage_book_covers.sql` — bucket `book-covers` и Storage policies.
16. `14_verify_storage_book_covers.sql` — проверка Storage setup.
17. `15_admin_book_crud_rpc.sql` — Stage 12 RPC для админского CRUD книг, связей авторов/жанров и stale AI-профиля.
18. `16_user_preferences_rls.sql` — Stage 13 own-only RLS для `public.user_preferences`.
19. `17_favorites_rls.sql` — Stage 14 own-only RLS для `public.favorites`.
20. `18_cart_items_rls.sql` — Stage 15 own-only RLS и integrity baseline для `public.cart_items`.
21. `19_orders_rpc_rls.sql` — Stage 16 RLS для заказов, RPC оформления заказа и admin RPC смены статуса.
22. `20_ai_analysis_lifecycle.sql` — Stage 17 RLS/status baseline для `book_ai_profiles` и `ai_analysis_jobs`.

В папке есть два файла с номером `08_`. На Stage 11 SQL-логику не меняем и файлы не переименовываем, чтобы не ломать существующие ссылки. Порядок выше фиксирует безопасную последовательность запуска.

## Vercel deployment

Vercel подключен к GitHub-репозиторию и автоматически запускает build после push.

Рекомендуемые настройки Vercel:

- Framework Preset: Vite
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

В Vercel Project Settings добавьте для Production/Preview/Development:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Можно использовать публичные переменные Supabase Integration:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

После изменения env-переменных выполните redeploy. Если были проблемы с кешем, используйте redeploy without build cache.

Для React/Vite SPA используется `vercel.json`, который переписывает все маршруты на `/index.html`. Прямое открытие этих маршрутов должно работать после deploy:

- `/catalog`
- `/book/:id`
- `/admin`
- `/checkout`
- `/orders`
- `/recommendations`
- `/api/analyze-book` доступен как Vercel Function, не как SPA route.

## Git workflow

Перед commit:

```bash
npm install
npm run build
git status
```

Commit и push:

```bash
git add .
git commit -m "chore: stabilize repo build and deployment setup"
git push
```

После push:

1. Откройте Vercel deployment logs.
2. Убедитесь, что install и build завершились успешно.
3. Откройте production URL.
4. Проверьте прямые SPA routes.
5. Проверьте browser console на отсутствие секретов, JWT, access token, session token и service role key.

## Files that must not be committed

Не добавляйте в Git и архивы:

- `node_modules/`
- `dist/`
- `.env`
- `.env.local`
- `.env.*.local`
- `.vercel/`
- debug logs
- OS/IDE мусор

Должны оставаться в Git:

- `.env.example`
- `package-lock.json`
- `vercel.json`
- `supabase/sql/*.sql`

## Build checklist

Local:

```bash
npm install
npm run dev
npm run build
npm run preview
```

Git:

```bash
git status
git add .
git commit -m "chore: stabilize repo build and deployment setup"
git push
```

Vercel:

- Проверить env variables.
- Проверить build logs.
- Проверить production URL.
- Открыть основные SPA routes напрямую.
- Проверить browser console.

## Stage 12 — Admin CRUD books

Stage 12 реализует реальное управление книгами в Supabase без service role key во frontend. Все операции выполняются из браузера через Supabase anon key, authenticated session и серверные RPC-функции, которые проверяют `public.is_admin()`.

### Используемые таблицы

- `public.books`
- `public.authors`
- `public.genres`
- `public.book_authors`
- `public.book_genres`
- `public.book_ai_profiles`
- `storage.objects` bucket `book-covers`

### Реализованные операции

- Создать книгу.
- Отредактировать книгу.
- Назначить авторов и жанры.
- Скрыть книгу через `is_active = false`.
- Восстановить книгу через `is_active = true`.
- Загрузить, заменить или удалить ссылку на обложку.
- Пометить AI-профиль как `pending` при создании книги или изменении описания.

### SQL для Stage 12

Перед проверкой админки выполните в Supabase SQL Editor:

```sql
-- supabase/sql/15_admin_book_crud_rpc.sql
```

Скрипт добавляет RPC:

- `admin_get_books()`
- `admin_get_book(uuid)`
- `admin_create_book(jsonb, uuid[], uuid[])`
- `admin_update_book(uuid, jsonb, uuid[], uuid[])`
- `admin_set_book_authors(uuid, uuid[])`
- `admin_set_book_genres(uuid, uuid[])`
- `admin_soft_delete_book(uuid)`
- `admin_restore_book(uuid)`
- `admin_mark_book_ai_profile_pending(uuid)`

### Как назначить admin

1. Зарегистрируйте пользователя через приложение.
2. Выполните `06_set_admin_example.sql`, заменив email-заглушку на реальный email пользователя.
3. Выйдите и войдите снова, чтобы frontend получил обновленную роль.

### Как проверить CRUD

1. Откройте `/admin` под пользователем с ролью `admin`.
2. Перейдите во вкладку «Книги».
3. Создайте книгу, выберите существующих авторов и жанры.
4. Загрузите JPG/PNG/WebP обложку до 5 MB.
5. Проверьте, что активная книга появилась в `/catalog`.
6. Отредактируйте цену, описание или обложку.
7. Проверьте карточку книги `/book/<slug>`.
8. Скрыть книгу — она должна исчезнуть из публичного каталога, но остаться в админке.
9. Восстановить книгу — она снова должна появиться в публичном каталоге.

### Ограничения до Stage 17

- До запуска `20_ai_analysis_lifecycle.sql` старые AI-статусы могут быть `pending`/`processing`/`error`.
- После Stage 17 они нормализуются в `stale`/`running`/`ready`/`failed`.
- Embedding/pgvector и semantic ranking не реализуются на Stage 12.

## Stage 14 — Favorites in Supabase

Stage 14 реализует настоящее избранное в Supabase без service role key во frontend. Source of truth — таблица `public.favorites`; React state используется только как cache текущей сессии.

### Используемые таблицы и view

- `public.favorites`
- `public.books`
- `public.book_catalog_view`
- `public.profiles` через Supabase Auth session

### SQL для Stage 14

Перед проверкой выполните в Supabase SQL Editor:

```sql
-- supabase/sql/17_favorites_rls.sql
```

Скрипт включает RLS для `favorites`, удаляет возможные широкие policies и создает owner-only policies для select/insert/delete.

### Как проверить избранное

1. Войти обычным пользователем.
2. Открыть `/catalog` и добавить активную книгу в избранное.
3. Проверить строку в `public.favorites` с `user_id` текущего пользователя и UUID книги.
4. Открыть `/favorites`, перезагрузить страницу и убедиться, что книга осталась.
5. Удалить книгу из избранного, перезагрузить страницу и убедиться, что она не вернулась.
6. Повторить под другим аккаунтом — списки должны быть разными.
7. Выйти и попробовать добавить книгу — должно появиться предложение войти.

### Ограничения до Stage 19

- Favorites уже сохраняются в Supabase, но полноценный recommendation scoring по избранному не реализован.
- Mock-рекомендации могут содержать старые `b1/b2` id; такие книги не сохраняются в Supabase favorites.
- User events и аналитика добавления в избранное остаются на будущий этап.

## Stage 15 — Cart in Supabase

Stage 15 реализует настоящую пользовательскую корзину в Supabase без service role key во frontend. Source of truth — таблица `public.cart_items`; React state используется только как cache текущей сессии.

### Используемые таблицы и view

- `public.cart_items`
- `public.books`
- `public.book_catalog_view` для актуальных цен, наличия, активности и карточек книг
- `public.profiles` через Supabase Auth session

### SQL для Stage 15

Перед проверкой выполните в Supabase SQL Editor:

```sql
-- supabase/sql/18_cart_items_rls.sql
```

Скрипт включает RLS для `cart_items`, проверяет constraints `unique(user_id, book_id)` и `quantity > 0`, удаляет возможные широкие policies и создает owner-only policies для select/insert/update/delete.

### Как проверить корзину

1. Войти обычным пользователем.
2. Открыть `/catalog` и добавить активную книгу в корзину.
3. Проверить строку в `public.cart_items` с `user_id` текущего пользователя, UUID книги и `quantity`.
4. Открыть `/cart`, изменить количество и перезагрузить страницу — quantity должен сохраниться.
5. Добавить ту же книгу повторно — должна увеличиться `quantity`, а не появиться вторая строка.
6. Удалить книгу из корзины, перезагрузить страницу и убедиться, что она не вернулась.
7. Повторить под другим аккаунтом — корзины должны быть разными.
8. Изменить цену книги в админке, перезагрузить корзину и проверить актуальную цену из Supabase.
9. Скрыть книгу в админке и проверить, что item помечен как недоступный.
10. Выйти и попробовать добавить книгу — должно появиться предложение войти.

### Что изменилось на Stage 16

- Страница `/checkout` больше не заблокирована: она отправляет заказ через RPC `create_order_from_cart`.
- Корзина остается source of truth до момента оформления. RPC сам читает `cart_items`, проверяет книги и считает итог.
- После успешного заказа корзина очищается на стороне БД, а frontend перезагружает cart state.
- История `/orders` загружается из `public.orders` и `public.order_items` по RLS.
- Админ-панель показывает реальные заказы и обновляет статус через `admin_update_order_status`.

## Stage 17 — AI-analysis lifecycle через OpenRouter

Stage 17 реализует безопасный серверный lifecycle ИИ-анализа книги через Vercel Serverless Function `POST /api/analyze-book`. Frontend не вызывает OpenRouter напрямую и не содержит `OPENROUTER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` или другие приватные ключи. React отправляет только `bookId` и Supabase access token текущего admin-пользователя в `Authorization: Bearer <token>`.

### Зачем нужен Stage 17

Этап подготавливает каталог к будущим рекомендациям и semantic search: для книги создается семантический профиль с кратким содержанием, темами, ключевыми словами, уровнем сложности, эмоциональным тоном и опциональным embedding. Recommendations, `user_events`, semantic search и checkout UX в этом этапе не реализуются.

### Используемые таблицы

- `public.books` — источник `title`, `description` и связей с авторами/жанрами.
- `public.profiles` — проверка `role = 'admin'`.
- `public.ai_analysis_jobs` — журнал запусков: `running`, `ready`, `failed`, `started_at`, `finished_at`, `error_message`.
- `public.book_ai_profiles` — результат анализа: `summary`, `topics`, `keywords`, `complexity_level`, `emotional_tone`, `embedding`, `status`, `updated_at`.

### Endpoint `/api/analyze-book`

Контракт запроса:

```http
POST /api/analyze-book
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

```json
{
  "bookId": "uuid"
}
```

Что делает serverless function:

1. Разрешает только `POST`; остальные методы получают `405`.
2. Валидирует JSON body и обязательный строковый `bookId`.
3. Проверяет Supabase access token через `auth.getUser(accessToken)`.
4. Через server-only Supabase client с `SUPABASE_SERVICE_ROLE_KEY` проверяет `profiles.role === 'admin'`.
5. Загружает книгу, авторов и жанры.
6. Создает job со статусом `running`.
7. Если нет `description`, завершает job как `failed` с безопасным сообщением `Book has no description or text fragment for AI analysis`.
8. Вызывает OpenRouter chat completions и требует строго валидный JSON.
9. Валидирует поля `summary`, `topics`, `keywords`, `complexity_level`, `emotional_tone`.
10. Если OpenRouter недоступен, ключ отсутствует, лимит исчерпан или JSON невалиден — использует локальный deterministic MVP fallback.
11. Если задан `OPENROUTER_EMBEDDING_MODEL`, пробует получить embedding через OpenRouter embeddings endpoint.
12. Если embedding не настроен или запрос embedding завершился ошибкой, сохраняет `embedding = null` и не считает это ошибкой Stage 17.
13. Делает upsert в `book_ai_profiles` по `book_id`.
14. Обновляет job на `ready` или `failed`.

Ответ успеха:

```json
{
  "ok": true,
  "job": {
    "id": "uuid",
    "book_id": "uuid",
    "status": "ready",
    "started_at": "...",
    "finished_at": "...",
    "error_message": null
  },
  "profile": {
    "book_id": "uuid",
    "summary": "...",
    "topics": ["..."],
    "keywords": ["..."],
    "complexity_level": 3,
    "emotional_tone": "познавательный",
    "embedding": null,
    "status": "ready",
    "updated_at": "..."
  },
  "fallbackUsed": false
}
```

### Server-side env для Vercel

Добавьте в Vercel Project Settings. Эти переменные не должны иметь prefix `VITE_` или `NEXT_PUBLIC_`.

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
OPENROUTER_EMBEDDING_MODEL=
APP_URL=
```

`OPENROUTER_MODEL` можно заменить на любую доступную модель, например `some/model:free`. Конкретная бесплатная модель не хардкодится, потому что список бесплатных моделей OpenRouter может меняться.

### Почему frontend не вызывает OpenRouter напрямую

OpenRouter API key и Supabase service role key являются приватными секретами. Если вызвать OpenRouter из React-компонента, ключ попадет в browser bundle или network-запросы. Поэтому frontend использует только Supabase anon key и access token пользователя, а внешняя AI-интеграция выполняется только в serverless function.

### MVP fallback без внешнего AI API

Fallback полностью локальный, deterministic и не использует внешний provider:

- `summary` берется из первых 1–2 предложений описания или осторожно собирается из title/authors/genres;
- `topics` формируются из жанров и частотных значимых слов описания;
- `keywords` извлекаются из описания со стоп-словами и lowercase-нормализацией;
- `complexity_level` рассчитывается по длине и сложности текста от 1 до 5;
- `emotional_tone` определяется простым словарем (`напряжённый`, `романтичный`, `динамичный`, `познавательный`, иначе `нейтральный`);
- `embedding` в fallback всегда `null`.

Fallback используется, если `OPENROUTER_API_KEY` не задан, OpenRouter вернул ошибку/лимит, модель недоступна или ответ не является валидным JSON. Job при этом может стать `ready`, а ответ содержит `fallbackUsed: true`.

### Embedding до Stage 19

`OPENROUTER_EMBEDDING_MODEL` опционален. Если он не задан или embeddings endpoint возвращает ошибку, `embedding` сохраняется как `null`; это нормальное MVP-поведение до Stage 19/20. Production-логика не генерирует fake-vector. Если в Supabase включен pgvector, function пробует сохранить embedding как vector-compatible literal; если формат/размерность не подходят текущей схеме, сохраняется `null`, чтобы не ломать анализ книги.

### SQL для Stage 17

Перед проверкой выполните в Supabase SQL Editor:

```sql
-- supabase/sql/20_ai_analysis_lifecycle.sql
```

Скрипт:

- нормализует статусы в `stale/running/ready/failed` для профилей и `running/ready/failed` для jobs;
- запрещает direct insert/update/delete в `book_ai_profiles` и `ai_analysis_jobs` для browser roles;
- разрешает чтение `ready` AI-профилей активных книг;
- разрешает admin читать все AI-профили и jobs;
- оставляет запись анализа только server-side через service role.

### Как проверить результат вручную

1. Выполнить `supabase/sql/20_ai_analysis_lifecycle.sql`.
2. Добавить server-only env в Vercel и сделать redeploy без cache.
3. Войти admin-пользователем.
4. Открыть `/admin → ИИ-анализ`.
5. Нажать «Запустить ИИ-анализ» для книги с заполненным описанием.
6. Проверить в Supabase:

```sql
select id, book_id, status, started_at, finished_at, error_message
from public.ai_analysis_jobs
order by started_at desc;

select book_id, summary, topics, keywords, complexity_level, emotional_tone, embedding, status, updated_at
from public.book_ai_profiles
order by updated_at desc;
```

### Testing checklist Stage 17

- Admin запускает анализ книги с `description`: job `running → ready`, профиль сохранен, UI показывает summary/topics/keywords/complexity/tone.
- Admin запускает анализ книги без `description`: job `failed`, safe `error_message`, UI показывает понятную ошибку.
- Несуществующий `bookId`: безопасная ошибка без SQL/provider деталей.
- Не-admin вызывает endpoint: `403`, записи не создаются.
- Пользователь без session вызывает endpoint: `401`.
- `OPENROUTER_API_KEY` отсутствует: работает fallback, job становится `ready`, `fallbackUsed = true`.
- OpenRouter возвращает invalid JSON: работает fallback, job становится `ready`, `fallbackUsed = true`.
- `npm run build` проходит успешно.

### Ограничения после Stage 17

- User events еще не пишутся до Stage 18.
- Recommendations еще не используют AI-профили до Stage 19.
- Semantic search/pgvector остается Stage 20.

## Next stages backlog

- Stage 18: User Events.
- Stage 19: Recommendations на основе preferences, favorites, cart/orders и AI-профилей.
- Stage 20: Semantic search / pgvector.


## Stage 16 — Orders RPC

Stage 16 реализует безопасное оформление заказа в Supabase без service role key во frontend. Source of truth для заказа — транзакционная RPC-функция `public.create_order_from_cart(...)`. Frontend передает только способ получения, контактные данные и комментарий; состав корзины, цены и итоговая сумма берутся из БД.

### Используемые таблицы

- `public.cart_items` — текущая корзина пользователя.
- `public.books` — актуальные цены, активность и `stock_qty`.
- `public.orders` — заказ пользователя.
- `public.order_items` — snapshot позиций заказа.

### SQL для Stage 16

Перед проверкой выполните в Supabase SQL Editor:

```sql
-- supabase/sql/19_orders_rpc_rls.sql
```

Скрипт добавляет:

- RLS для `public.orders`;
- RLS для `public.order_items`;
- RPC `create_order_from_cart(p_delivery_type, p_contact_json, p_comment)`;
- RPC `admin_update_order_status(p_order_id, p_status)`;
- grants/revokes, запрещающие прямую запись в orders/order_items из frontend.

### Как проверить оформление заказа

1. Войти обычным пользователем.
2. Открыть `/catalog` и добавить активную книгу в корзину.
3. Открыть `/checkout`.
4. Заполнить имя, email, способ получения и при необходимости телефон/адрес.
5. Нажать «Оформить заказ».
6. Проверить, что появился toast «Заказ создан».
7. Убедиться, что `/orders` показывает новый заказ и состав.
8. Проверить в Supabase, что `orders.total_amount` равен сумме актуальных `books.price × cart_items.quantity`, а `order_items` содержит `title_snapshot` и `price_snapshot`.
9. Проверить, что `cart_items` текущего пользователя очищен.
10. Войти другим пользователем — он не должен видеть заказ первого пользователя.
11. Войти admin и открыть `/admin → Заказы` — admin должен видеть все заказы и менять статус.

### Ограничения до следующих этапов

- User events не пишутся при оформлении заказа до Stage 18.
- Рекомендации пока не используют историю заказов до Stage 19.

## Stage 18 — User events

Stage 18 добавляет безопасное логирование минимальных пользовательских событий в `public.user_events` для будущих рекомендаций и аналитики. Это не реализация Recommendations и не semantic search: текущий слой только пишет события.

### Таблица `public.user_events`

Поля:

- `id` — UUID primary key.
- `user_id` — UUID профиля или `null` для гостя.
- `book_id` — UUID книги, если событие связано с книгой.
- `event_type` — одно из: `book_view`, `search`, `favorite_add`, `favorite_remove`, `cart_add`, `cart_remove`, `purchase`, `recommendation_click`.
- `event_payload` — минимальный `jsonb` payload.
- `created_at` — время события.

Payload намеренно ограничен техническими полями события: `book_id`, `quantity`, `query`, `order_id`, `recommendation_id`. В payload нельзя писать email, телефон, адрес, JWT/session, checkout contact или другие лишние персональные данные.

### Frontend service

Создан `src/services/userEventService.ts`:

- `logBookView(bookId)`
- `logSearch(query)`
- `logFavoriteAdd(bookId)`
- `logFavoriteRemove(bookId)`
- `logCartAdd(bookId, quantity)`
- `logCartRemove(bookId)`
- `logPurchase(orderId)`
- `logRecommendationClick(bookId, recommendationId)`

Сервис берет текущую Supabase session. Если пользователь авторизован, пишет `user_id = session.user.id`; если сессии нет, пишет `user_id = null`. Ошибки логирования не показываются пользователю и выводятся только в dev console.

### Где события пишутся

- `/book/:id` — `book_view` при успешной загрузке карточки книги.
- `/catalog` и `/search` — `search` при явном поисковом запросе.
- `favoritesService` — `favorite_add` и `favorite_remove` после успешного изменения избранного.
- `cartService` — `cart_add` и `cart_remove` после успешного изменения корзины.
- `orderService.createOrderFromCart` — `purchase` после успешного RPC-заказа.
- `RecommendationsPage` и блок похожих книг на карточке — `recommendation_click` при открытии рекомендованной книги.

### SQL/RLS

Перед проверкой выполните в Supabase SQL Editor:

```sql
-- supabase/sql/21_user_events_rls.sql
```

Скрипт:

- включает RLS для `public.user_events`;
- нормализует старый `event_type = 'view'` в `book_view`;
- обновляет check constraint для Stage 18 event types;
- разрешает authenticated user вставлять только свои события: `user_id = auth.uid()`;
- разрешает guest/anon вставлять только события с `user_id is null`;
- разрешает authenticated user читать только свои события;
- запрещает browser roles выполнять update/delete;
- ограничивает размер `event_payload`.

### Проверка Stage 18

1. Гость открывает карточку книги или выполняет поиск: появляется событие с `user_id = null`.
2. Авторизованный пользователь открывает карточку: появляется `book_view` с `user_id` и `book_id`.
3. Добавление/удаление избранного пишет `favorite_add` / `favorite_remove`.
4. Добавление/удаление корзины пишет `cart_add` / `cart_remove`.
5. Оформление заказа пишет `purchase` с `order_id`.
6. Клик по рекомендованной/похожей книге пишет `recommendation_click`.
7. Другой пользователь не видит чужие события.
8. Анонимный клиент не может читать события.
9. Попытки UPDATE/DELETE из frontend должны быть отклонены.

```sql
select id, user_id, book_id, event_type, event_payload, created_at
from public.user_events
order by created_at desc
limit 50;
```

### Ограничения после Stage 18

- Recommendations еще не используют `user_events`; это Stage 19.
- Semantic search / pgvector не изменялись; это Stage 20.
- Логирование выполняется direct insert через Supabase anon client + RLS, без service role key во frontend.
