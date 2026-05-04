-- Интеллекта | Stage 5
-- Подготовка к RLS. На этом этапе активные политики не включаются,
-- чтобы не заблокировать будущую интеграцию до Stage RLS/Auth.
-- Запускайте после 01_schema.sql и 03_triggers.sql.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'Возвращает true, если текущий Supabase Auth пользователь имеет роль admin в public.profiles.';

-- Рекомендуемый план RLS для следующих этапов:
--
-- 1. Публичные справочники и каталог:
-- alter table public.books enable row level security;
-- create policy "Активные книги доступны всем" on public.books
--   for select using (is_active = true or public.is_admin());
--
-- alter table public.authors enable row level security;
-- create policy "Авторы доступны всем" on public.authors
--   for select using (true);
--
-- alter table public.genres enable row level security;
-- create policy "Жанры доступны всем" on public.genres
--   for select using (true);
--
-- alter table public.book_ai_profiles enable row level security;
-- create policy "Готовые ИИ-профили доступны всем" on public.book_ai_profiles
--   for select using (status = 'ready' or public.is_admin());
--
-- 2. Пользовательские данные:
-- alter table public.profiles enable row level security;
-- create policy "Пользователь читает свой профиль" on public.profiles
--   for select using (id = auth.uid() or public.is_admin());
-- create policy "Пользователь обновляет свой профиль" on public.profiles
--   for update using (id = auth.uid()) with check (id = auth.uid() and role = 'user');
--
-- alter table public.user_preferences enable row level security;
-- create policy "Пользователь управляет своими предпочтениями" on public.user_preferences
--   for all using (user_id = auth.uid() or public.is_admin())
--   with check (user_id = auth.uid() or public.is_admin());
--
-- alter table public.favorites enable row level security;
-- create policy "Пользователь управляет своим избранным" on public.favorites
--   for all using (user_id = auth.uid() or public.is_admin())
--   with check (user_id = auth.uid() or public.is_admin());
--
-- alter table public.cart_items enable row level security;
-- create policy "Пользователь управляет своей корзиной" on public.cart_items
--   for all using (user_id = auth.uid() or public.is_admin())
--   with check (user_id = auth.uid() or public.is_admin());
--
-- alter table public.orders enable row level security;
-- create policy "Пользователь видит свои заказы" on public.orders
--   for select using (user_id = auth.uid() or public.is_admin());
--
-- 3. Админские операции:
-- Администраторские insert/update/delete для книг, авторов, жанров, заказов и ИИ-задач
-- должны использовать public.is_admin() и добавляться на этапе полноценной RLS-настройки.
--
-- Важно: service role key нельзя использовать во frontend-коде.
-- Роль admin назначается только через SQL/админский backend, не через клиентский интерфейс.
