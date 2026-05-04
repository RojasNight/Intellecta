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

Supabase подключен к Vercel через **Vercel Integrations**, но на этом этапе основные данные приложения остаются mock-данными. Каталог, авторизация, корзина, заказы, рекомендации и админские сценарии будут переноситься на Supabase на следующих этапах.

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
