# SQL-скрипты Supabase для «Интеллекта»

Все изменения базы данных выполняйте через **Supabase SQL Editor**. Не создавайте таблицы и политики вручную через UI, если можно применить SQL-скрипт: так схема остается воспроизводимой для ВКР.

## Порядок запуска

### Базовая проверка

0. `00_connection_check.sql` — необязательная проверка доступа к SQL Editor.

### Stage 5: схема данных

1. `01_schema.sql` — таблицы, связи, ограничения и базовое представление каталога.
2. `02_indexes.sql` — индексы.
3. `03_triggers.sql` — `updated_at` и создание профиля после регистрации Supabase Auth.
4. `04_rls_prepare.sql` — подготовка RLS и `public.is_admin()`.
5. `99_verify_schema.sql` — проверка созданной схемы.

### Stage 6: Supabase Auth и роли

6. `05_auth_roles.sql` — профиль пользователя, триггер `handle_new_user()`, роль по умолчанию `user`.
7. `07_auth_rls.sql` — RLS для `profiles` и `user_preferences`.
8. Зарегистрируйте пользователя через приложение.
9. `06_set_admin_example.sql` — назначение роли `admin` зарегистрированному пользователю. Перед запуском замените email-заглушку на реальный email.

### Stage 7: каталог книг

10. `08_catalog_fixes.sql` — безопасные дополнения для каталожных таблиц, если они нужны.
11. `09_catalog_view.sql` — представление `public.book_catalog_view` для frontend-каталога.
12. `10_catalog_rls.sql` — политики чтения каталога и админ-доступа.
13. `12_seed_catalog.sql` — демонстрационные книги, авторы, жанры и ИИ-профили.
14. `11_verify_catalog.sql` — проверка каталога.

### Stage 8: обложки книг через Supabase Storage

15. `13_storage_book_covers.sql` — bucket `book-covers`, публичное чтение, загрузка/обновление/удаление только для admin.
16. `14_verify_storage_book_covers.sql` — проверка bucket и Storage policies.

### Stage 12: Admin CRUD книг

17. `15_admin_book_crud_rpc.sql` — RPC-функции для создания, редактирования, скрытия, восстановления книг, синхронизации авторов/жанров и pending AI-профиля.

### Stage 13: профиль предпочтений пользователя

18. `16_user_preferences_rls.sql` — сужает RLS для `public.user_preferences` до owner-only доступа: `user_id = auth.uid()` для select/insert/update/delete.
19. `17_favorites_rls.sql` — сужает RLS для `public.favorites` до owner-only доступа: `user_id = auth.uid()` для select/insert/delete.
20. `18_cart_items_rls.sql` — сужает RLS для `public.cart_items` до owner-only доступа: `user_id = auth.uid()` для select/insert/update/delete и проверяет constraints корзины.
21. `19_orders_rpc_rls.sql` — Stage 16: RLS для `orders`/`order_items`, RPC `create_order_from_cart(...)` и `admin_update_order_status(...)`.
22. `20_ai_analysis_lifecycle.sql` — Stage 17: RLS/status baseline для `book_ai_profiles` и `ai_analysis_jobs`, read-only browser access, stale/running/ready/failed statuses.
23. `21_user_events_rls.sql` — Stage 18: нормализация `book_view`, RLS для `user_events`, guest insert с `user_id is null`, запрет update/delete.

## Важные правила

- Не используйте service role key во frontend.
- Не коммитьте `.env`, `.env.local`, дампы базы и реальные секреты.
- Bucket для обложек называется `book-covers`.
- Обложки доступны публично для чтения, потому что это витринные изображения каталога.
- Загружать, заменять и удалять обложки может только пользователь с ролью `admin` в `public.profiles`.
- Если обложка не загружена, frontend показывает спокойную fallback-обложку.

## Stage 12 проверки

После запуска `15_admin_book_crud_rpc.sql` проверьте под admin-пользователем:

```sql
select count(*) from public.admin_get_books();
```

Обычный authenticated user без роли `admin` не должен получать доступ к admin RPC-операциям изменения каталога.


## Stage 13 проверки

После запуска `16_user_preferences_rls.sql` проверьте через приложение:

1. Авторизованный пользователь может сохранить preferences на странице `/preferences`.
2. В `public.user_preferences` появляется или обновляется строка с `user_id` текущего пользователя.
3. После reload и logout/login значения снова загружаются.
4. Другой пользователь не видит preferences первого пользователя.
5. Неавторизованный пользователь перенаправляется на login и не может сохранить preferences.

Для ручной SQL-проверки структуры:

```sql
select user_id, genres, topics, goals, complexity_min, complexity_max, excluded_genres, updated_at
from public.user_preferences
order by updated_at desc nulls last;
```

SQL Editor может выполняться без app auth-сессии, поэтому RLS-поведение надежнее проверять из приложения под реальными пользователями.


## Stage 14 проверки

После запуска `17_favorites_rls.sql` проверьте через приложение:

1. Авторизованный пользователь может добавить книгу в избранное из `/catalog` или карточки книги.
2. В `public.favorites` появляется строка с `user_id` текущего пользователя и UUID книги.
3. После reload и logout/login избранное снова загружается.
4. Другой пользователь не видит избранное первого пользователя.
5. Неавторизованный пользователь не может создать запись в `favorites`.
6. Повторное добавление той же книги не создает дубль из-за `primary key (user_id, book_id)`.

Для ручной SQL-проверки структуры:

```sql
select user_id, book_id, created_at
from public.favorites
order by created_at desc;
```

SQL Editor может выполняться без app auth-сессии, поэтому RLS-поведение надежнее проверять из приложения под реальными пользователями.


## Stage 15 проверки

После запуска `18_cart_items_rls.sql` проверьте через приложение:

1. Авторизованный пользователь может добавить активную книгу в корзину из `/catalog` или карточки книги.
2. В `public.cart_items` появляется строка с `user_id` текущего пользователя, UUID книги и `quantity`.
3. Повторное добавление той же книги увеличивает `quantity`, а не создает дубль.
4. После reload и logout/login корзина снова загружается.
5. Другой пользователь не видит корзину первого пользователя.
6. Неавторизованный пользователь не может создать запись в `cart_items`.
7. Изменение quantity на странице `/cart` сохраняется в Supabase.
8. Удаление позиции не возвращается после reload.

Для ручной SQL-проверки структуры:

```sql
select id, user_id, book_id, quantity, created_at, updated_at
from public.cart_items
order by updated_at desc nulls last;
```

SQL Editor может выполняться без app auth-сессии, поэтому RLS-поведение надежнее проверять из приложения под реальными пользователями.


## Stage 16 проверки

После запуска `19_orders_rpc_rls.sql` проверьте через приложение:

1. Авторизованный пользователь добавляет активные книги в корзину.
2. Пользователь открывает `/checkout`, заполняет контакты и нажимает «Оформить заказ».
3. В `public.orders` появляется заказ с `user_id = auth.uid()`, статусом `created`, `total_amount`, `delivery_type` и `contact_json`.
4. В `public.order_items` появляются позиции с `title_snapshot`, `price_snapshot` и `quantity`.
5. `public.cart_items` текущего пользователя очищается.
6. `/orders` показывает только заказы текущего пользователя.
7. Другой пользователь не видит эти заказы.
8. Admin во вкладке `/admin → Заказы` видит все заказы и меняет статус через RPC `admin_update_order_status`.
9. Обычный пользователь не может напрямую изменить статус или чужой заказ.

Для ручной SQL-проверки структуры:

```sql
select id, user_id, status, total_amount, delivery_type, contact_json, created_at
from public.orders
order by created_at desc;

select order_id, book_id, title_snapshot, price_snapshot, quantity, created_at
from public.order_items
order by created_at desc;
```

Важно: прямые INSERT/UPDATE/DELETE на `orders` и `order_items` не выдаются frontend-роли. Создание заказа выполняется только через RPC, чтобы frontend не мог подменить сумму, цены или snapshot позиций. SQL Editor может выполняться без app auth-сессии, поэтому RLS-поведение надежнее проверять из приложения под реальными пользователями.


## Stage 17 проверки

После запуска `20_ai_analysis_lifecycle.sql` проверьте через приложение:

1. В Vercel Project Settings добавлен server-only `SUPABASE_SERVICE_ROLE_KEY`.
2. Опционально добавлен `OPENROUTER_API_KEY`; если его нет или OpenRouter недоступен, серверная функция использует MVP fallback.
3. Admin открывает `/admin → ИИ-анализ` и запускает анализ книги с заполненным описанием.
4. В `public.ai_analysis_jobs` создается job со статусом `running`, затем `ready` или `failed`.
5. В `public.book_ai_profiles` создается/обновляется профиль со статусом `ready`, `summary`, `topics`, `keywords`, `complexity_level`, `emotional_tone`.
6. Книга без описания должна завершать job статусом `failed` и понятным `error_message`.
7. Обычный пользователь не может вызвать `/api/analyze-book` успешно.
8. Прямые INSERT/UPDATE/DELETE в `book_ai_profiles` и `ai_analysis_jobs` из browser client должны быть запрещены.

Для ручной SQL-проверки структуры:

```sql
select book_id, status, summary, topics, keywords, complexity_level, emotional_tone, updated_at
from public.book_ai_profiles
order by updated_at desc nulls last;

select id, book_id, status, started_at, finished_at, error_message, created_at
from public.ai_analysis_jobs
order by created_at desc;
```

Важно: browser frontend использует только anon key и admin session token. `SUPABASE_SERVICE_ROLE_KEY` используется только в Vercel Serverless Function `/api/analyze-book` и не должен иметь prefix `VITE_` или `NEXT_PUBLIC_`.


## Stage 18 проверки

После запуска `21_user_events_rls.sql` проверьте через приложение:

1. Гость открывает карточку книги или выполняет поиск — в `public.user_events` создается событие с `user_id = null`.
2. Авторизованный пользователь открывает карточку книги — создается `book_view` с `user_id = auth.uid()` и `book_id`.
3. Добавление/удаление избранного создает `favorite_add` / `favorite_remove`.
4. Добавление/удаление корзины создает `cart_add` / `cart_remove`; payload содержит только `book_id` и при добавлении `quantity`.
5. Оформление заказа через RPC создает `purchase` с `order_id`.
6. Клик по карточке рекомендации создает `recommendation_click` с `book_id` и `recommendation_id`.
7. Другой authenticated user не видит события первого пользователя.
8. Анонимный клиент не может читать `user_events`.
9. UPDATE/DELETE для browser roles должны быть запрещены.

Для ручной SQL-проверки структуры:

```sql
select id, user_id, book_id, event_type, event_payload, created_at
from public.user_events
order by created_at desc
limit 50;
```

Важно: `event_payload` предназначен только для минимальных технических полей события. Email, телефон, адрес, токены, полный checkout contact и другие PII туда не пишутся.
