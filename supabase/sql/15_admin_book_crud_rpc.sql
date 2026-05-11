-- Stage 12: Admin CRUD books RPC
-- Run in Supabase SQL Editor after Stage 11A security/RLS scripts and Stage 8 storage scripts.
-- These functions are intended for browser clients using the public anon key + authenticated admin session.
-- They never require or expose a service role key.

create extension if not exists pgcrypto;

create or replace function public.admin_require_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_slugify(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.admin_get_books()
returns table (
  id uuid,
  title text,
  slug text,
  description text,
  isbn text,
  publisher text,
  publication_year int,
  price numeric,
  format text,
  cover_url text,
  stock_qty int,
  rating numeric,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  authors jsonb,
  genres jsonb,
  ai_summary text,
  ai_topics jsonb,
  ai_keywords jsonb,
  complexity_level int,
  emotional_tone text,
  ai_status text,
  ai_updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
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
    coalesce(authors.items, '[]'::jsonb) as authors,
    coalesce(genres.items, '[]'::jsonb) as genres,
    bap.summary as ai_summary,
    coalesce(bap.topics, '[]'::jsonb) as ai_topics,
    coalesce(bap.keywords, '[]'::jsonb) as ai_keywords,
    bap.complexity_level,
    bap.emotional_tone,
    bap.status as ai_status,
    bap.updated_at as ai_updated_at
  from public.books b
  left join public.book_ai_profiles bap on bap.book_id = b.id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('id', a.id, 'full_name', a.full_name, 'bio', a.bio)
      order by a.full_name
    ) as items
    from public.book_authors ba
    join public.authors a on a.id = ba.author_id
    where ba.book_id = b.id
  ) authors on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('id', g.id, 'name', g.name, 'slug', g.slug, 'parent_id', g.parent_id)
      order by g.name
    ) as items
    from public.book_genres bg
    join public.genres g on g.id = bg.genre_id
    where bg.book_id = b.id
  ) genres on true
  where public.is_admin()
  order by b.updated_at desc, b.created_at desc;
$$;

create or replace function public.admin_get_book(p_book_id uuid)
returns table (
  id uuid,
  title text,
  slug text,
  description text,
  isbn text,
  publisher text,
  publication_year int,
  price numeric,
  format text,
  cover_url text,
  stock_qty int,
  rating numeric,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  authors jsonb,
  genres jsonb,
  ai_summary text,
  ai_topics jsonb,
  ai_keywords jsonb,
  complexity_level int,
  emotional_tone text,
  ai_status text,
  ai_updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select *
  from public.admin_get_books() as b
  where b.id = p_book_id
  limit 1;
$$;

create or replace function public.admin_set_book_authors(p_book_id uuid, p_author_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require_admin();

  if not exists (select 1 from public.books where id = p_book_id) then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;

  if coalesce(array_length(p_author_ids, 1), 0) = 0 then
    raise exception 'At least one author is required' using errcode = '23514';
  end if;

  if exists (
    select 1
    from unnest(p_author_ids) as selected_author_id
    left join public.authors a on a.id = selected_author_id
    where a.id is null
  ) then
    raise exception 'Invalid author id' using errcode = '23503';
  end if;

  delete from public.book_authors
  where book_id = p_book_id
    and author_id <> all(p_author_ids);

  insert into public.book_authors (book_id, author_id)
  select p_book_id, distinct_author_id
  from (select distinct unnest(p_author_ids) as distinct_author_id) x
  on conflict (book_id, author_id) do nothing;
end;
$$;

create or replace function public.admin_set_book_genres(p_book_id uuid, p_genre_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require_admin();

  if not exists (select 1 from public.books where id = p_book_id) then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;

  if coalesce(array_length(p_genre_ids, 1), 0) = 0 then
    raise exception 'At least one genre is required' using errcode = '23514';
  end if;

  if exists (
    select 1
    from unnest(p_genre_ids) as selected_genre_id
    left join public.genres g on g.id = selected_genre_id
    where g.id is null
  ) then
    raise exception 'Invalid genre id' using errcode = '23503';
  end if;

  delete from public.book_genres
  where book_id = p_book_id
    and genre_id <> all(p_genre_ids);

  insert into public.book_genres (book_id, genre_id)
  select p_book_id, distinct_genre_id
  from (select distinct unnest(p_genre_ids) as distinct_genre_id) x
  on conflict (book_id, genre_id) do nothing;
end;
$$;

create or replace function public.admin_mark_book_ai_profile_pending(p_book_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require_admin();

  insert into public.book_ai_profiles (
    book_id,
    summary,
    topics,
    keywords,
    complexity_level,
    emotional_tone,
    status,
    updated_at
  )
  values (
    p_book_id,
    null,
    '[]'::jsonb,
    '[]'::jsonb,
    null,
    null,
    'pending',
    now()
  )
  on conflict (book_id) do update
  set
    status = 'pending',
    updated_at = now();
end;
$$;

create or replace function public.admin_create_book(p_book jsonb, p_author_ids uuid[], p_genre_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_book_id uuid;
  clean_slug text;
  publication_year_value int;
begin
  perform public.admin_require_admin();

  clean_slug := nullif(trim(p_book->>'slug'), '');
  if clean_slug is null then
    clean_slug := public.admin_slugify(p_book->>'title');
  end if;

  publication_year_value := nullif(p_book->>'publication_year', '')::int;

  insert into public.books (
    title,
    slug,
    description,
    isbn,
    publisher,
    publication_year,
    price,
    format,
    cover_url,
    stock_qty,
    is_active
  )
  values (
    nullif(trim(p_book->>'title'), ''),
    clean_slug,
    nullif(trim(p_book->>'description'), ''),
    nullif(trim(p_book->>'isbn'), ''),
    nullif(trim(p_book->>'publisher'), ''),
    publication_year_value,
    coalesce(nullif(p_book->>'price', '')::numeric, 0),
    coalesce(nullif(p_book->>'format', ''), 'paper'),
    nullif(trim(p_book->>'cover_url'), ''),
    coalesce(nullif(p_book->>'stock_qty', '')::int, 0),
    coalesce((p_book->>'is_active')::boolean, true)
  )
  returning id into new_book_id;

  perform public.admin_set_book_authors(new_book_id, p_author_ids);
  perform public.admin_set_book_genres(new_book_id, p_genre_ids);

  if nullif(trim(p_book->>'description'), '') is not null then
    perform public.admin_mark_book_ai_profile_pending(new_book_id);
  end if;

  return new_book_id;
end;
$$;

create or replace function public.admin_update_book(p_book_id uuid, p_book jsonb, p_author_ids uuid[], p_genre_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_description text;
  new_description text;
  clean_slug text;
  publication_year_value int;
begin
  perform public.admin_require_admin();

  select description into old_description
  from public.books
  where id = p_book_id;

  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;

  clean_slug := nullif(trim(p_book->>'slug'), '');
  if clean_slug is null then
    clean_slug := public.admin_slugify(p_book->>'title');
  end if;

  new_description := nullif(trim(p_book->>'description'), '');
  publication_year_value := nullif(p_book->>'publication_year', '')::int;

  update public.books
  set
    title = nullif(trim(p_book->>'title'), ''),
    slug = clean_slug,
    description = new_description,
    isbn = nullif(trim(p_book->>'isbn'), ''),
    publisher = nullif(trim(p_book->>'publisher'), ''),
    publication_year = publication_year_value,
    price = coalesce(nullif(p_book->>'price', '')::numeric, 0),
    format = coalesce(nullif(p_book->>'format', ''), 'paper'),
    cover_url = nullif(trim(p_book->>'cover_url'), ''),
    stock_qty = coalesce(nullif(p_book->>'stock_qty', '')::int, 0),
    is_active = coalesce((p_book->>'is_active')::boolean, true),
    updated_at = now()
  where id = p_book_id;

  perform public.admin_set_book_authors(p_book_id, p_author_ids);
  perform public.admin_set_book_genres(p_book_id, p_genre_ids);

  if old_description is distinct from new_description then
    perform public.admin_mark_book_ai_profile_pending(p_book_id);
  end if;
end;
$$;

create or replace function public.admin_soft_delete_book(p_book_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require_admin();

  update public.books
  set is_active = false, updated_at = now()
  where id = p_book_id;

  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_restore_book(p_book_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require_admin();

  update public.books
  set is_active = true, updated_at = now()
  where id = p_book_id;

  if not found then
    raise exception 'Book not found' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.admin_require_admin() to authenticated;
grant execute on function public.admin_get_books() to authenticated;
grant execute on function public.admin_get_book(uuid) to authenticated;
grant execute on function public.admin_set_book_authors(uuid, uuid[]) to authenticated;
grant execute on function public.admin_set_book_genres(uuid, uuid[]) to authenticated;
grant execute on function public.admin_mark_book_ai_profile_pending(uuid) to authenticated;
grant execute on function public.admin_create_book(jsonb, uuid[], uuid[]) to authenticated;
grant execute on function public.admin_update_book(uuid, jsonb, uuid[], uuid[]) to authenticated;
grant execute on function public.admin_soft_delete_book(uuid) to authenticated;
grant execute on function public.admin_restore_book(uuid) to authenticated;

comment on function public.admin_create_book(jsonb, uuid[], uuid[]) is
  'Stage 12: creates a catalog book and synchronizes author/genre links for authenticated admins only.';

comment on function public.admin_update_book(uuid, jsonb, uuid[], uuid[]) is
  'Stage 12: updates a catalog book, synchronizes author/genre links and marks AI profile pending when description changes.';
