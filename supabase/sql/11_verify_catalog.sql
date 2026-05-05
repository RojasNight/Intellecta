-- Stage 7: catalog verification script

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('books','authors','genres','book_authors','book_genres','book_ai_profiles')
order by table_name;

select count(*) as books_total from public.books;
select count(*) as active_books from public.books where is_active = true;
select count(*) as authors_total from public.authors;
select count(*) as genres_total from public.genres;
select count(*) as catalog_view_rows from public.book_catalog_view;

select id, title, slug, price, rating, authors, genres, ai_topics, ai_status
from public.book_catalog_view
order by rating desc
limit 5;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('books','authors','genres','book_authors','book_genres','book_ai_profiles')
order by c.relname;
