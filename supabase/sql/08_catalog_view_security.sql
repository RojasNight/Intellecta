-- Интеллекта | Stage 6 optional
-- Убирает предупреждение Supabase "UNRESTRICTED" для book_catalog_view,
-- пересоздавая view как security_invoker. Скрипт не меняет таблицы и данные.

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
