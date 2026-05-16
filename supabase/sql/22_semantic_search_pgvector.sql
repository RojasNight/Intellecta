-- Интеллекта | Stage 2 Semantic Search
-- Реальный смысловой поиск: pgvector + RPC match_books_semantic.
-- Запускайте после 20_ai_analysis_lifecycle.sql.

create schema if not exists extensions;
create extension if not exists vector with schema extensions;
set search_path = public, extensions;

-- book_ai_profiles.embedding должен быть pgvector-вектором выбранной размерности.
-- Для MVP используется OpenRouter model openai/text-embedding-3-small с dimensions = 1536.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'book_ai_profiles'
      and column_name = 'embedding'
      and udt_name <> 'vector'
  ) then
    alter table public.book_ai_profiles
      alter column embedding type extensions.vector(1536)
      using case
        when embedding is null then null
        else embedding::text::extensions.vector(1536)
      end;
  end if;
exception
  when others then
    raise exception 'Не удалось привести public.book_ai_profiles.embedding к vector(1536). Проверьте существующие данные embedding и примените миграцию вручную. Ошибка: %', sqlerrm;
end;
$$;

alter table public.book_ai_profiles
  add column if not exists embedding_model text,
  add column if not exists embedding_dimension integer,
  add column if not exists embedding_updated_at timestamptz,
  add column if not exists embedding_status text not null default 'missing',
  add column if not exists embedding_error text;

alter table public.book_ai_profiles
  drop constraint if exists book_ai_profiles_embedding_status_check;

alter table public.book_ai_profiles
  add constraint book_ai_profiles_embedding_status_check
  check (embedding_status in ('missing', 'ready', 'failed'));

update public.book_ai_profiles
set
  embedding_status = case when embedding is not null then 'ready' else coalesce(nullif(embedding_status, ''), 'missing') end,
  embedding_dimension = case when embedding is not null then coalesce(embedding_dimension, 1536) else embedding_dimension end,
  embedding_updated_at = case when embedding is not null then coalesce(embedding_updated_at, updated_at, now()) else embedding_updated_at end
where embedding is not null
   or embedding_status is null
   or embedding_status = '';

create index if not exists book_ai_profiles_embedding_hnsw_idx
  on public.book_ai_profiles
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create index if not exists book_ai_profiles_embedding_status_idx
  on public.book_ai_profiles (embedding_status);

create or replace function public.match_books_semantic(
  p_query_embedding extensions.vector(1536),
  p_limit integer default 10,
  p_min_similarity double precision default 0.35,
  p_genre_id uuid default null,
  p_format text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_only_active boolean default true
)
returns table (
  book_id uuid,
  slug text,
  title text,
  description text,
  price numeric,
  format text,
  cover_url text,
  stock_qty integer,
  rating numeric,
  is_active boolean,
  similarity double precision,
  ai_summary text,
  topics jsonb,
  keywords jsonb,
  complexity_level integer,
  emotional_tone text,
  authors jsonb,
  genres jsonb
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with matched_books as (
    select
      b.id as book_id,
      b.slug,
      b.title,
      b.description,
      b.price,
      b.format,
      b.cover_url,
      b.stock_qty,
      b.rating,
      b.is_active,
      (1 - (bap.embedding <=> p_query_embedding))::double precision as similarity,
      bap.summary as ai_summary,
      coalesce(bap.topics, '[]'::jsonb) as topics,
      coalesce(bap.keywords, '[]'::jsonb) as keywords,
      bap.complexity_level,
      bap.emotional_tone
    from public.books b
    join public.book_ai_profiles bap on bap.book_id = b.id
    where bap.embedding is not null
      and bap.embedding_status = 'ready'
      and coalesce(bap.embedding_dimension, 1536) = 1536
      and bap.status = 'ready'
      and (not p_only_active or b.is_active = true)
      and (p_format is null or b.format = p_format)
      and (p_min_price is null or b.price >= p_min_price)
      and (p_max_price is null or b.price <= p_max_price)
      and (
        p_genre_id is null
        or exists (
          select 1
          from public.book_genres bg
          where bg.book_id = b.id
            and bg.genre_id = p_genre_id
        )
      )
      and (1 - (bap.embedding <=> p_query_embedding)) >= coalesce(p_min_similarity, 0.35)
  )
  select
    mb.book_id,
    mb.slug,
    mb.title,
    mb.description,
    mb.price,
    mb.format,
    mb.cover_url,
    mb.stock_qty,
    mb.rating,
    mb.is_active,
    mb.similarity,
    mb.ai_summary,
    mb.topics,
    mb.keywords,
    mb.complexity_level,
    mb.emotional_tone,
    coalesce(authors.items, '[]'::jsonb) as authors,
    coalesce(genres.items, '[]'::jsonb) as genres
  from matched_books mb
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('id', a.id, 'full_name', a.full_name)
      order by a.full_name
    ) as items
    from public.book_authors ba
    join public.authors a on a.id = ba.author_id
    where ba.book_id = mb.book_id
  ) authors on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('id', g.id, 'name', g.name, 'slug', g.slug)
      order by g.name
    ) as items
    from public.book_genres bg
    join public.genres g on g.id = bg.genre_id
    where bg.book_id = mb.book_id
  ) genres on true
  order by mb.similarity desc, mb.rating desc, mb.title asc
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

grant execute on function public.match_books_semantic(
  extensions.vector(1536), integer, double precision, uuid, text, numeric, numeric, boolean
) to anon, authenticated;

comment on function public.match_books_semantic(
  extensions.vector(1536), integer, double precision, uuid, text, numeric, numeric, boolean
) is
  'Stage 2 Semantic Search: returns only public catalog fields for active books with ready embeddings. SECURITY DEFINER is safe because the function does not expose private user data and applies active/status filters.';

comment on column public.book_ai_profiles.embedding is
  'Stage 2: vector(1536) embedding for semantic search. Generated server-side from title, authors, genres, description and AI profile.';

comment on column public.book_ai_profiles.embedding_model is
  'Stage 2: embedding model name, e.g. openai/text-embedding-3-small.';

comment on column public.book_ai_profiles.embedding_dimension is
  'Stage 2: embedding vector dimension. MVP default is 1536.';

-- Verification:
-- select count(*) as total_ai_profiles, count(*) filter (where embedding is not null) as profiles_with_embedding from public.book_ai_profiles;
-- select proname, pg_get_function_arguments(oid), pg_get_function_result(oid) from pg_proc where proname = 'match_books_semantic';
