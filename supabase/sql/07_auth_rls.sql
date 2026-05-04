-- Интеллекта | Stage 6
-- Базовые RLS-политики для auth-связанных таблиц.
-- Запускайте после 05_auth_roles.sql.

-- Защита от повышения роли через клиентский update.
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- В SQL Editor auth.uid() обычно null; это позволяет владельцу БД назначить первого администратора.
  if auth.uid() is null then
    return new;
  end if;

  if old.role is distinct from new.role and not public.is_admin() then
    raise exception 'Недостаточно прав для изменения роли пользователя';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation
before update on public.profiles
for each row execute function public.prevent_profile_role_escalation();

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;

-- profiles policies

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- user_preferences policies

drop policy if exists "preferences_select_own_or_admin" on public.user_preferences;
create policy "preferences_select_own_or_admin"
on public.user_preferences
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "preferences_insert_own_or_admin" on public.user_preferences;
create policy "preferences_insert_own_or_admin"
on public.user_preferences
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "preferences_update_own_or_admin" on public.user_preferences;
create policy "preferences_update_own_or_admin"
on public.user_preferences
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "preferences_delete_own_or_admin" on public.user_preferences;
create policy "preferences_delete_own_or_admin"
on public.user_preferences
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());
