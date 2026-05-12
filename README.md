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

На текущем этапе приложение работает как React/Vite SPA и обращается к Supabase напрямую из браузера через публичный anon key. Service role key во frontend запрещен.

## Current stage/status

Текущий этап: **Stage 14 — избранное пользователя через Supabase**.

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
- При создании книги или изменении описания AI-профиль помечается как `pending` для будущего Stage 17.

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

Пока не переносится в рамках Stage 14:

- Cart/Orders на Supabase.
- Полноценные рекомендации из Supabase.
- User events.
- Реальный AI-analysis job pipeline.
- pgvector/semantic search.

## Local development in VS Code

1. Откройте папку проекта в VS Code.
2. Создайте `.env.local` на основе `.env.example`.
3. Установите зависимости:

```bash
npm install
```

4. Запустите dev-сервер:

```bash
npm run dev
```

5. Откройте локальный URL из терминала Vite.
6. Перед push проверьте production build:

```bash
npm run build
```

7. При необходимости проверьте production build локально:

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
- `SUPABASE_SERVICE_ROLE_KEY` нельзя использовать во frontend, `.env.example`, README-примерах или Vercel client-side variables.
- `DATABASE_URL`, private OpenAI/API keys и другие server-side secrets нельзя добавлять в браузерный bundle.

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

Stage 15 перенесет Cart, Stage 19 будет использовать favorites для рекомендаций из Supabase.

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
17. `15_admin_book_crud_rpc.sql` — Stage 12 RPC для админского CRUD книг, связей авторов/жанров и pending AI-профиля.
18. `16_user_preferences_rls.sql` — Stage 13 own-only RLS для `public.user_preferences`.
19. `17_favorites_rls.sql` — Stage 14 own-only RLS для `public.favorites`.

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

- Кнопки реального запуска AI-analysis нет.
- `book_ai_profiles.status = pending` означает, что книге нужен будущий анализ.
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

## Next stages backlog

- Stage 15: Cart в Supabase.
- Stage 16: Orders RPC и транзакционное оформление заказа.
- Stage 17: AI-analysis lifecycle, jobs, worker/edge function и embeddings.
