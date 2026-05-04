# SQL-скрипты Supabase

Здесь находятся SQL-скрипты для **Supabase SQL Editor** проекта «Интеллекта».

Не создавайте таблицы вручную через UI, если можно применить SQL-скрипт. Так схема базы данных остается воспроизводимой для ВКР, GitHub и демонстрационного стенда.

## Порядок запуска Stage 5

Откройте Supabase Dashboard → SQL Editor и выполните скрипты по порядку:

1. `00_connection_check.sql` — безопасная проверка, что SQL Editor выполняет запросы.
2. `01_schema.sql` — расширения, таблицы, связи, ограничения и представление `book_catalog_view`.
3. `02_indexes.sql` — индексы для каталога, поиска, заказов, ИИ-профилей и пользовательских событий.
4. `03_triggers.sql` — функция `set_updated_at`, updated_at-триггеры и автосоздание `profiles` после регистрации в Supabase Auth.
5. `04_rls_prepare.sql` — helper-функция `public.is_admin()` и документированный план RLS.
6. `99_verify_schema.sql` — проверка наличия таблиц, ограничений, индексов, функций и триггеров.

## Порядок запуска Stage 6: Auth и роли

После Stage 5 выполните:

1. `05_auth_roles.sql` — проверяет/добавляет `profiles`, роль `user/admin`, `handle_new_user()` и `public.is_admin()`.
2. `07_auth_rls.sql` — включает базовые RLS-политики для `profiles` и `user_preferences`, а также защиту от повышения роли через клиентский update.
3. `08_catalog_view_security.sql` — опционально пересоздает `book_catalog_view` как `security_invoker`, чтобы убрать предупреждение Supabase о публичном security definer view.
4. Зарегистрируйте пользователя через приложение.
5. `06_set_admin_example.sql` — замените `admin@example.com` на email зарегистрированного пользователя и выполните скрипт, чтобы назначить роль администратора.
6. Выйдите из приложения и войдите снова, чтобы frontend перечитал `profile.role`.

## Что создается в Stage 5

Основные таблицы:

- `profiles`
- `user_preferences`
- `books`
- `authors`
- `genres`
- `book_authors`
- `book_genres`
- `book_ai_profiles`
- `favorites`
- `cart_items`
- `orders`
- `order_items`
- `reviews`
- `ai_analysis_jobs`
- `user_events`

Дополнительно:

- `public.book_catalog_view` для будущего удобного чтения каталога;
- `public.set_updated_at()` для автоматического обновления `updated_at`;
- `public.handle_new_user()` для создания профиля при регистрации через Supabase Auth;
- `public.is_admin()` для будущих RLS-политик.

## Важные правила безопасности

- Не используйте `SUPABASE_SERVICE_ROLE_KEY` во frontend-коде.
- Не коммитьте `.env`, `.env.local`, дампы БД и реальные ключи.
- Роль `admin` назначается только через SQL Editor или защищенный backend, а не через публичный интерфейс.
- Не размещайте пароли, токены или инструкции по получению роли администратора в публичном UI.
- После включения RLS проверяйте доступы обычного пользователя и администратора отдельно.

## pgvector

В `01_schema.sql` используется `create extension if not exists vector;` и поле `book_ai_profiles.embedding vector(1536)`.

Если в конкретном Supabase-окружении расширение `vector` недоступно, используйте fallback, описанный в комментарии внутри `01_schema.sql`: хранить embedding как `jsonb`. Для стандартного Supabase-проекта pgvector обычно доступен.

## Следующие этапы

На следующих этапах можно добавить:

- `seed.sql` — демонстрационные книги, авторы, жанры и ИИ-профили;
- SQL для Storage bucket обложек книг;
- RPC/functions для рекомендаций и семантического поиска;
- интеграцию каталога, корзины и заказов с реальными таблицами.
