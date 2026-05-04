-- Интеллекта | Stage 6
-- Пример назначения роли администратора через Supabase SQL Editor.
-- 1. Сначала зарегистрируйте пользователя через приложение.
-- 2. Замените admin@example.com на email этого пользователя.
-- 3. Выполните скрипт и перелогиньтесь в приложении.

update public.profiles
set role = 'admin',
    updated_at = now()
where email = 'admin@example.com';

select id, email, name, role
from public.profiles
where email = 'admin@example.com';
