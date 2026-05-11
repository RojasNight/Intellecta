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

Текущий этап: **Stage 11 — техническая стабилизация репозитория**.

Готово на предыдущих этапах:

- Supabase Auth для регистрации, входа, выхода и определения роли пользователя.
- Чтение каталога через `public.book_catalog_view`.
- Поддержка Supabase Storage bucket `book-covers` для обложек.
- Vercel SPA routing через `vercel.json`.

Пока не переносится в рамках Stage 11:

- Admin CRUD для книг.
- Preferences/Favorites/Cart/Orders на Supabase.
- Реальный AI-analysis job pipeline.
- Stage 11A RLS/security baseline для бизнес-таблиц.

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

## Stage 11A backlog

Stage 11A должен быть отдельным этапом и не входит в текущую стабилизацию:

- RLS/security baseline для `favorites`, `cart_items`, `orders`, `order_items`, `reviews`, `user_events`, `ai_analysis_jobs`.
- RPC/transaction для оформления заказа.
- Защищенный admin CRUD поверх Supabase.
- Перенос preferences/favorites/cart/orders из local state в Supabase.
- Реальный AI-analysis job lifecycle.
