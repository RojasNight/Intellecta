-- Интеллекта | Stage 14
-- RLS baseline для избранного пользователя.
-- Запускайте после Stage 11A hardening и после 01_schema.sql/02_indexes.sql.
--
-- Цель: authenticated user может читать, добавлять и удалять только свои строки
-- public.favorites, где user_id = auth.uid(). Гость не может создавать избранное.

alter table public.favorites enable row level security;

-- Primary key (user_id, book_id) уже создается в 01_schema.sql. Этот блок оставлен
-- как verify-friendly guard для проектов, где схема применялась вручную.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.favorites'::regclass
      and contype in ('p', 'u')
      and conname in ('favorites_pkey', 'favorites_user_book_unique')
  ) then
    alter table public.favorites
      add constraint favorites_user_book_unique unique (user_id, book_id);
  end if;
end;
$$;

-- Удаляем возможные более широкие политики из ранних security baseline.
drop policy if exists "Пользователь управляет своим избранным" on public.favorites;
drop policy if exists "favorites_select_own_or_admin" on public.favorites;
drop policy if exists "favorites_insert_own_or_admin" on public.favorites;
drop policy if exists "favorites_delete_own_or_admin" on public.favorites;
drop policy if exists "favorites_update_own_or_admin" on public.favorites;

-- Повторный запуск скрипта безопасен.
drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
on public.favorites
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
on public.favorites
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
on public.favorites
for delete
to authenticated
using (user_id = auth.uid());

comment on table public.favorites is
  'Избранные книги пользователя. Доступ из frontend разрешен только владельцу строки через RLS user_id = auth.uid().';

-- Verify после запуска под app-сессией:
-- 1) select * from public.favorites; должен вернуть только строки текущего пользователя.
-- 2) insert разрешен только с user_id = auth.uid().
-- 3) delete разрешен только для user_id = auth.uid().
-- 4) повторный insert той же книги должен блокироваться primary key / unique constraint.
