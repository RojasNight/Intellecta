-- Stage 7: frontend-friendly catalog view
-- Run in Supabase SQL Editor after schema scripts.
-- The view is dropped first because PostgreSQL cannot change existing view column order/names with CREATE OR REPLACE VIEW.

drop view if exists public.book_catalog_view;

create view public.book_catalog_view
with (security_invoker = true)
as
select
  b.id,
  b.title,
  b.slug,
  b.description,
  b.isbn,
  b.publisher,
  b.publication_year,
  b.price,
  b.format,
  b.cover_url,
  b.stock_qty,
  b.rating,
  b.is_active,
  b.created_at,
  b.updated_at,
  coalesce(
    jsonb_agg(
      distinct jsonb_build_object(
        'id', a.id,
        'full_name', a.full_name
      )
    ) filter (where a.id is not null),
    '[]'::jsonb
  ) as authors,
  coalesce(
    jsonb_agg(
      distinct jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'slug', g.slug
      )
    ) filter (where g.id is not null),
    '[]'::jsonb
  ) as genres,
  bap.summary as ai_summary,
  coalesce(bap.topics, '[]'::jsonb) as ai_topics,
  coalesce(bap.keywords, '[]'::jsonb) as ai_keywords,
  bap.complexity_level,
  bap.emotional_tone,
  bap.status as ai_status,
  bap.updated_at as ai_updated_at
from public.books b
left join public.book_authors ba on ba.book_id = b.id
left join public.authors a on a.id = ba.author_id
left join public.book_genres bg on bg.book_id = b.id
left join public.genres g on g.id = bg.genre_id
left join public.book_ai_profiles bap on bap.book_id = b.id
where b.is_active = true
group by
  b.id,
  bap.summary,
  bap.topics,
  bap.keywords,
  bap.complexity_level,
  bap.emotional_tone,
  bap.status,
  bap.updated_at;
