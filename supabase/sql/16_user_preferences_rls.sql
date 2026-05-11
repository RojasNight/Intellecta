-- Интеллекта | Stage 13
-- RLS baseline для личного профиля предпочтений пользователя.
-- Запускайте после 07_auth_rls.sql и Stage 11A hardening.
--
-- Цель: authenticated user может читать и изменять только свою строку
-- public.user_preferences, где user_id = auth.uid().

alter table public.user_preferences enable row level security;

-- Удаляем прежние более широкие политики, где admin мог читать/изменять чужие preferences.
drop policy if exists "preferences_select_own_or_admin" on public.user_preferences;
drop policy if exists "preferences_insert_own_or_admin" on public.user_preferences;
drop policy if exists "preferences_update_own_or_admin" on public.user_preferences;
drop policy if exists "preferences_delete_own_or_admin" on public.user_preferences;

-- Повторный запуск скрипта безопасен.
drop policy if exists "preferences_select_own" on public.user_preferences;
create policy "preferences_select_own"
on public.user_preferences
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "preferences_insert_own" on public.user_preferences;
create policy "preferences_insert_own"
on public.user_preferences
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "preferences_update_own" on public.user_preferences;
create policy "preferences_update_own"
on public.user_preferences
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "preferences_delete_own" on public.user_preferences;
create policy "preferences_delete_own"
on public.user_preferences
for delete
to authenticated
using (user_id = auth.uid());

comment on table public.user_preferences is
  'Личные предпочтения чтения. Доступ из frontend разрешен только владельцу строки через RLS user_id = auth.uid().';

-- Verify после запуска под app-сессией:
-- 1) select * from public.user_preferences; должен вернуть только строку текущего пользователя.
-- 2) insert/upsert разрешен только с user_id = auth.uid().
-- 3) попытка выбрать/изменить чужой user_id должна быть заблокирована RLS.
