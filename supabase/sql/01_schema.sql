-- Интеллекта | Stage 5
-- Базовая схема Supabase PostgreSQL для MVP.
-- Запускайте через Supabase SQL Editor.
-- Скрипт не содержит seed-данных и не удаляет существующие таблицы.

create extension if not exists pgcrypto;

-- Для семантического поиска в Supabase обычно доступно расширение pgvector.
-- Если расширение недоступно в конкретном окружении, скрипт продолжит работу
-- и создаст поле embedding как jsonb.
do $$
begin
  create extension if not exists vector;
exception
  when others then
    raise notice 'Расширение vector недоступно. book_ai_profiles.embedding будет создан как jsonb.';
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('user', 'admin'))
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  genres jsonb not null default '[]'::jsonb,
  topics jsonb not null default '[]'::jsonb,
  goals jsonb not null default '[]'::jsonb,
  complexity_min int not null default 1,
  complexity_max int not null default 5,
  excluded_genres jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_complexity_min_check check (complexity_min between 1 and 5),
  constraint user_preferences_complexity_max_check check (complexity_max between 1 and 5),
  constraint user_preferences_complexity_range_check check (complexity_min <= complexity_max)
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  isbn text,
  publisher text,
  publication_year int,
  price numeric(10,2) not null default 0,
  format text not null default 'paper',
  cover_url text,
  stock_qty int not null default 0,
  rating numeric(3,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint books_price_check check (price >= 0),
  constraint books_stock_qty_check check (stock_qty >= 0),
  constraint books_rating_check check (rating >= 0 and rating <= 5),
  constraint books_publication_year_check check (
    publication_year is null
    or (publication_year between 1000 and (extract(year from now())::int + 1))
  ),
  constraint books_format_check check (format in ('paper', 'ebook', 'audiobook'))
);

create table if not exists public.authors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.genres (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  parent_id uuid references public.genres(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_authors (
  book_id uuid not null references public.books(id) on delete cascade,
  author_id uuid not null references public.authors(id) on delete restrict,
  primary key (book_id, author_id)
);

create table if not exists public.book_genres (
  book_id uuid not null references public.books(id) on delete cascade,
  genre_id uuid not null references public.genres(id) on delete restrict,
  primary key (book_id, genre_id)
);

do $$
declare
  embedding_column_type text;
begin
  embedding_column_type := case
    when exists (select 1 from pg_type where typname = 'vector') then 'vector(1536)'
    else 'jsonb'
  end;

  execute format($create_table$
    create table if not exists public.book_ai_profiles (
      book_id uuid primary key references public.books(id) on delete cascade,
      summary text,
      topics jsonb not null default '[]'::jsonb,
      keywords jsonb not null default '[]'::jsonb,
      complexity_level int,
      emotional_tone text,
      embedding %s,
      status text not null default 'pending',
      updated_at timestamptz not null default now(),
      constraint book_ai_profiles_complexity_level_check check (
        complexity_level is null or complexity_level between 1 and 5
      ),
      constraint book_ai_profiles_status_check check (status in ('pending', 'processing', 'ready', 'error'))
    )
  $create_table$, embedding_column_type);
end;
$$;

-- Если pgvector доступен, embedding создается как vector(1536).
-- Если pgvector недоступен, embedding создается как jsonb без изменения остальной схемы.

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  quantity int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_quantity_check check (quantity > 0),
  constraint cart_items_user_book_unique unique (user_id, book_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'created',
  total_amount numeric(10,2) not null default 0,
  delivery_type text not null default 'pickup',
  contact_json jsonb not null default '{}'::jsonb,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_status_check check (status in ('created', 'processing', 'completed', 'cancelled')),
  constraint orders_total_amount_check check (total_amount >= 0),
  constraint orders_delivery_type_check check (delivery_type in ('pickup', 'courier', 'digital'))
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  title_snapshot text not null,
  price_snapshot numeric(10,2) not null,
  quantity int not null default 1,
  created_at timestamptz not null default now(),
  constraint order_items_price_snapshot_check check (price_snapshot >= 0),
  constraint order_items_quantity_check check (quantity > 0)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  rating int not null,
  text text,
  moderation_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_moderation_status_check check (moderation_status in ('pending', 'published', 'rejected')),
  constraint reviews_user_book_unique unique (user_id, book_id)
);

create table if not exists public.ai_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  status text not null default 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  constraint ai_analysis_jobs_status_check check (status in ('queued', 'processing', 'ready', 'error')),
  constraint ai_analysis_jobs_finished_at_check check (
    finished_at is null or started_at is null or finished_at >= started_at
  )
);

create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  book_id uuid references public.books(id) on delete cascade,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_events_event_type_check check (
    event_type in (
      'view',
      'favorite_add',
      'favorite_remove',
      'cart_add',
      'cart_remove',
      'purchase',
      'search',
      'recommendation_click'
    )
  )
);

create or replace view public.book_catalog_view
with (security_invoker = true)
as
select
  b.id,
  b.title,
  b.slug,
  b.description,
  b.price,
  b.format,
  b.cover_url,
  b.stock_qty,
  b.rating,
  b.is_active,
  b.created_at,
  b.updated_at,
  coalesce(authors.items, '[]'::jsonb) as authors,
  coalesce(genres.items, '[]'::jsonb) as genres,
  ai.summary as ai_summary,
  ai.topics as ai_topics,
  ai.keywords as ai_keywords,
  ai.complexity_level as ai_complexity_level,
  ai.emotional_tone as ai_emotional_tone,
  ai.status as ai_status
from public.books b
left join public.book_ai_profiles ai on ai.book_id = b.id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'full_name', a.full_name
    )
    order by a.full_name
  ) as items
  from public.book_authors ba
  join public.authors a on a.id = ba.author_id
  where ba.book_id = b.id
) authors on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'slug', g.slug
    )
    order by g.name
  ) as items
  from public.book_genres bg
  join public.genres g on g.id = bg.genre_id
  where bg.book_id = b.id
) genres on true
where b.is_active = true;
