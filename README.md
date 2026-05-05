# Интеллекта

Фронтенд-прототип дипломного проекта «Интеллекта» — русскоязычный веб-сервис онлайн-продажи книг с ИИ-анализом содержания и объяснимыми рекомендациями.

## Технологии

- React
- Vite
- TypeScript
- Vercel для хостинга
- Supabase PostgreSQL / Auth / Storage для следующих этапов интеграции

## Локальный запуск

Установите зависимости:

```bash
npm install
```

Запустите dev-сервер:

```bash
npm run dev
```

Проверьте production-сборку:

```bash
npm run build
```

Предпросмотр production-сборки:

```bash
npm run preview
```

## Supabase

Supabase подключен к Vercel через **Vercel Integrations**. После Stage 6 авторизация работает через Supabase Auth, а каталог, корзина, заказы, рекомендации и админские сценарии пока остаются mock-данными и будут переноситься на Supabase на следующих этапах.

Откройте **Vercel Project Settings → Environment Variables** и проверьте, какие переменные были созданы интеграцией Supabase.

Для Vite переменные, которые используются во frontend-коде, должны начинаться с `VITE_`.

Обязательные frontend-переменные:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Если Vercel Integration создала переменные без префикса `VITE_`, например `SUPABASE_URL` или `SUPABASE_ANON_KEY`, добавьте Vite-версии переменных в Vercel или сопоставьте их при настройке окружения:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Клиентский код также умеет читать публичные переменные `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`, если они уже есть в окружении, но для этого проекта предпочтительны именно `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.

Не используйте `SUPABASE_SERVICE_ROLE_KEY` во frontend-коде. Service role key нельзя раскрывать в браузере, коммитах, README, интерфейсе или логах.

### Локальная настройка Supabase

1. Создайте файл `.env.local` в корне проекта.
2. Добавьте публичные переменные Supabase:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

3. Перезапустите dev-сервер после изменения `.env.local`:

```bash
npm run dev
```

Не коммитьте `.env.local` и другие реальные env-файлы в Git. Для примера в репозитории оставлен только `.env.example` с placeholder-значениями.

### Настройка Supabase-переменных в Vercel

1. Supabase Integration может уже создать часть переменных автоматически.
2. Откройте **Vercel Settings → Environment Variables**.
3. Убедитесь, что `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` существуют для **Production**, **Preview** и **Development**.
4. Если переменных с `VITE_` нет, создайте их вручную на основе публичных Supabase Project URL и anon public key.
5. Выполните redeploy проекта после изменений.

Для Vercel используйте настройки:

- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

### SQL setup

Все изменения схемы базы данных должны применяться через **Supabase SQL Editor**. На следующих этапах используйте SQL-скрипты вместо ручного создания таблиц через UI.

Папка для будущих SQL-скриптов:

```text
supabase/sql/
```

В Stage 4 добавлен только безопасный проверочный скрипт:

```text
supabase/sql/00_connection_check.sql
```

Он проверяет, что SQL Editor выполняет запросы, и не создает таблицы.


## База данных Supabase / Stage 5

Схема базы данных для MVP находится в папке:

```text
supabase/sql/
```

Все изменения БД выполняются через **Supabase SQL Editor**, а не ручным созданием таблиц через UI. Для Stage 5 подготовлены скрипты:

1. `00_connection_check.sql` — проверка SQL Editor;
2. `01_schema.sql` — таблицы, связи, ограничения и представление каталога;
3. `02_indexes.sql` — индексы;
4. `03_triggers.sql` — `updated_at` и создание профиля после Supabase Auth-регистрации;
5. `04_rls_prepare.sql` — подготовка к RLS и функция `public.is_admin()`;
6. `99_verify_schema.sql` — проверка созданной схемы.

После Stage 6 frontend использует Supabase Auth для регистрации, входа, выхода и определения роли. Каталог, корзина, заказы, рекомендации и админские данные пока остаются mock-данными и будут переноситься на Supabase на следующих этапах.

## Статус Supabase в разработке

Компонент `SupabaseStatus` предназначен только для режима разработки. Он показывает только безопасное состояние конфигурации:

- «Supabase подключен»
- «Supabase не настроен»

Ключи, service role key и другие секретные значения в интерфейсе не отображаются.

## Важно для архива и Git

Не добавляйте в Git и архивы:

- `node_modules`
- `dist`
- `.dist`
- `build`
- `.env`
- `.env.local`
- `.env.development.local`
- `.env.test.local`
- `.env.production.local`

## Supabase Auth и роли / Stage 6

В Stage 6 проект использует **Supabase Auth email/password** для регистрации, входа и выхода. Роли приложения хранятся не в frontend-коде, а в таблице `public.profiles`.

Роли:

- `guest` — неавторизованный посетитель;
- `user` — обычный пользователь;
- `admin` — администратор.

Новые пользователи автоматически получают профиль в `public.profiles` и роль `user`. Это делает SQL-триггер `public.handle_new_user()` после регистрации в `auth.users`.

Для Stage 6 выполните SQL-скрипты в Supabase SQL Editor:

1. `supabase/sql/05_auth_roles.sql`
2. `supabase/sql/07_auth_rls.sql`
3. при необходимости `supabase/sql/08_catalog_view_security.sql`;
4. зарегистрируйте пользователя через приложение;
5. при необходимости назначьте администратора через `supabase/sql/06_set_admin_example.sql`.

### Как создать первого администратора

1. Зарегистрируйтесь через страницу регистрации приложения.
2. Откройте Supabase Dashboard → SQL Editor.
3. Откройте `supabase/sql/06_set_admin_example.sql`.
4. Замените `admin@example.com` на email зарегистрированного пользователя.
5. Выполните скрипт.
6. Выйдите из приложения и войдите снова.

Назначение роли администратора выполняется только через SQL Editor или защищенный backend. В публичном интерфейсе приложения нет инструкций, паролей или обходных способов получить роль администратора.

### Безопасность Auth

- Не используйте `SUPABASE_SERVICE_ROLE_KEY` во frontend-коде.
- Не коммитьте реальные `.env`-файлы, токены и ключи.
- Не показывайте JWT/session token в UI и логах.
- Проверка admin-доступа выполняется по `public.profiles.role`, а не по email-префиксу.
- Базовые RLS-политики для `profiles` и `user_preferences` находятся в `07_auth_rls.sql`.

Vercel Integration уже подключена, но для Vite в браузере должны быть доступны переменные с префиксом `VITE_`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Диагностика Supabase Auth на Vercel

Если регистрация или вход показывают сообщение «Не удалось подключиться к сервису авторизации», откройте DevTools → Console и Network.

В Console приложение выводит безопасные диагностические сообщения с префиксами:

- `[Интеллекта][supabase]`
- `[Интеллекта][auth]`

В логах показываются только безопасные признаки: наличие URL, наличие anon key, host Supabase URL, статус ошибки и код ошибки. Значения ключей, JWT и service role key не выводятся.

Для Vite на Vercel должны быть доступны переменные:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

После изменения переменных окружения в Vercel обязательно выполните новый деплой без кеша.

Для React Router SPA на Vercel используется файл `vercel.json`, который направляет все маршруты на `index.html`.


### Переменные Supabase из Vercel Integration

В этом проекте Vite настроен так, чтобы читать публичные переменные с префиксами `VITE_` и `NEXT_PUBLIC_`. Поэтому текущие переменные Vercel Integration подходят, если в проекте есть:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Также поддерживается новый публичный ключ Supabase:

```env
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Серверные переменные без публичного префикса, например `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL`, не используются во frontend и не должны попадать в браузерный код. После изменения переменных на Vercel нужно выполнить Redeploy без build cache.

## Каталог книг через Supabase

Stage 7 переводит каталог, карточку книги, популярные книги на главной и смысловой поиск на данные Supabase. Frontend читает каталог через `src/services/catalogService.ts` и представление `public.book_catalog_view`.

Скрипты для Supabase SQL Editor:

1. `supabase/sql/08_catalog_fixes.sql` — безопасные уточнения схемы каталога.
2. `supabase/sql/09_catalog_view.sql` — view для чтения каталога одним запросом.
3. `supabase/sql/10_catalog_rls.sql` — RLS-политики для публичного чтения активных книг и админского управления.
4. `supabase/sql/12_seed_catalog.sql` — демонстрационные книги, авторы, жанры и ИИ-профили.
5. `supabase/sql/11_verify_catalog.sql` — проверка результата.

Ограничения этапа:

- Корзина и избранное пока остаются локальными/mock.
- Заказы пока не сохраняются в Supabase.
- Смысловой поиск на этом этапе эвристический: он ищет по названию, описанию, авторам, жанрам, `ai_topics` и `ai_keywords`. Векторный поиск через embedding будет подключен позже.
- Не используйте service role key во frontend.
