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
