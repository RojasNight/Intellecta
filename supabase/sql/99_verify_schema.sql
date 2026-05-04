-- Интеллекта | Stage 5
-- Проверка созданной схемы. Скрипт ничего не изменяет.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'user_preferences',
    'books',
    'authors',
    'genres',
    'book_authors',
    'book_genres',
    'book_ai_profiles',
    'favorites',
    'cart_items',
    'orders',
    'order_items',
    'reviews',
    'ai_analysis_jobs',
    'user_events'
  )
order by table_name;

select count(*) as created_table_count
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'user_preferences',
    'books',
    'authors',
    'genres',
    'book_authors',
    'book_genres',
    'book_ai_profiles',
    'favorites',
    'cart_items',
    'orders',
    'order_items',
    'reviews',
    'ai_analysis_jobs',
    'user_events'
  );

select
  tc.table_name,
  tc.constraint_type,
  tc.constraint_name
from information_schema.table_constraints tc
where tc.table_schema = 'public'
  and tc.table_name in (
    'profiles',
    'user_preferences',
    'books',
    'authors',
    'genres',
    'book_authors',
    'book_genres',
    'book_ai_profiles',
    'favorites',
    'cart_items',
    'orders',
    'order_items',
    'reviews',
    'ai_analysis_jobs',
    'user_events'
  )
order by tc.table_name, tc.constraint_type, tc.constraint_name;

select
  schemaname,
  tablename,
  indexname
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'books',
    'authors',
    'genres',
    'book_ai_profiles',
    'favorites',
    'cart_items',
    'orders',
    'order_items',
    'reviews',
    'ai_analysis_jobs',
    'user_events'
  )
order by tablename, indexname;

select
  routine_name,
  routine_type
from information_schema.routines
where specific_schema = 'public'
  and routine_name in ('set_updated_at', 'handle_new_user', 'is_admin')
order by routine_name;

select
  event_object_table as table_name,
  trigger_name
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;

-- Stage 6 checks: auth roles, RLS and policies.
select
  routine_name,
  routine_type
from information_schema.routines
where specific_schema = 'public'
  and routine_name in ('prevent_profile_role_escalation')
order by routine_name;

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'user_preferences')
order by tablename;

select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'user_preferences')
order by tablename, policyname;
