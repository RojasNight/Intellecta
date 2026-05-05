-- Stage 7: catalog RLS policies
-- Public users can read active catalog data. Only admins can manage catalog data.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

alter table public.books enable row level security;
alter table public.authors enable row level security;
alter table public.genres enable row level security;
alter table public.book_authors enable row level security;
alter table public.book_genres enable row level security;
alter table public.book_ai_profiles enable row level security;

drop policy if exists "Public can read active books" on public.books;
create policy "Public can read active books"
on public.books
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Admins can manage books" on public.books;
create policy "Admins can manage books"
on public.books
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read authors linked to active books" on public.authors;
create policy "Public can read authors linked to active books"
on public.authors
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.book_authors ba
    join public.books b on b.id = ba.book_id
    where ba.author_id = authors.id
      and b.is_active = true
  )
);

drop policy if exists "Admins can manage authors" on public.authors;
create policy "Admins can manage authors"
on public.authors
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read genres linked to active books" on public.genres;
create policy "Public can read genres linked to active books"
on public.genres
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.book_genres bg
    join public.books b on b.id = bg.book_id
    where bg.genre_id = genres.id
      and b.is_active = true
  )
);

drop policy if exists "Admins can manage genres" on public.genres;
create policy "Admins can manage genres"
on public.genres
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read active book author links" on public.book_authors;
create policy "Public can read active book author links"
on public.book_authors
for select
to anon, authenticated
using (exists (select 1 from public.books b where b.id = book_authors.book_id and b.is_active = true));

drop policy if exists "Admins can manage book author links" on public.book_authors;
create policy "Admins can manage book author links"
on public.book_authors
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read active book genre links" on public.book_genres;
create policy "Public can read active book genre links"
on public.book_genres
for select
to anon, authenticated
using (exists (select 1 from public.books b where b.id = book_genres.book_id and b.is_active = true));

drop policy if exists "Admins can manage book genre links" on public.book_genres;
create policy "Admins can manage book genre links"
on public.book_genres
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read ready AI profiles for active books" on public.book_ai_profiles;
create policy "Public can read ready AI profiles for active books"
on public.book_ai_profiles
for select
to anon, authenticated
using (
  status = 'ready'
  and exists (select 1 from public.books b where b.id = book_ai_profiles.book_id and b.is_active = true)
);

drop policy if exists "Admins can manage AI profiles" on public.book_ai_profiles;
create policy "Admins can manage AI profiles"
on public.book_ai_profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
