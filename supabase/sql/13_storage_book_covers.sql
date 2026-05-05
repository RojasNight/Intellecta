-- Stage 8: Supabase Storage bucket for book covers
-- Run this script in Supabase SQL Editor.
-- Bucket: book-covers
-- Public read: yes
-- Upload/update/delete: admin only through public.is_admin()

create extension if not exists pgcrypto;

-- Create or update the public Storage bucket.
-- Supabase stores bucket settings in storage.buckets.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'book-covers',
  'book-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Helper used by Storage policies. It should already exist from Stage 6,
-- but the definition is kept here to make this script safe to run independently.
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

-- Storage policies for book-covers.
-- Public users can read covers because covers are not private personal data.
-- Only authenticated admins can upload, replace, or delete files.

drop policy if exists "Book covers are publicly readable" on storage.objects;
drop policy if exists "Admins can upload book covers" on storage.objects;
drop policy if exists "Admins can update book covers" on storage.objects;
drop policy if exists "Admins can delete book covers" on storage.objects;

create policy "Book covers are publicly readable"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'book-covers'
);

create policy "Admins can upload book covers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'book-covers'
  and public.is_admin()
);

create policy "Admins can update book covers"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'book-covers'
  and public.is_admin()
)
with check (
  bucket_id = 'book-covers'
  and public.is_admin()
);

create policy "Admins can delete book covers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'book-covers'
  and public.is_admin()
);

-- Keep catalog update policy explicit for cover_url updates.
-- If this policy already exists from Stage 7, it is recreated safely.
alter table public.books enable row level security;

drop policy if exists "Admins can update catalog books" on public.books;

create policy "Admins can update catalog books"
on public.books
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
