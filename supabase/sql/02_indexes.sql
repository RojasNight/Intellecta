-- Интеллекта | Stage 5
-- Индексы для MVP-схемы. Запускайте после 01_schema.sql.

create extension if not exists pg_trgm;

create index if not exists books_is_active_idx on public.books (is_active);
create index if not exists books_price_idx on public.books (price);
create index if not exists books_format_idx on public.books (format);
create index if not exists books_rating_idx on public.books (rating);
create index if not exists books_active_price_idx on public.books (is_active, price);
create index if not exists books_title_lower_idx on public.books (lower(title));
create index if not exists books_title_trgm_idx on public.books using gin (title gin_trgm_ops);
create index if not exists books_description_trgm_idx on public.books using gin (description gin_trgm_ops);

create index if not exists authors_full_name_idx on public.authors (full_name);
create index if not exists authors_full_name_trgm_idx on public.authors using gin (full_name gin_trgm_ops);

create index if not exists genres_slug_idx on public.genres (slug);
create index if not exists genres_parent_id_idx on public.genres (parent_id);

create index if not exists book_ai_profiles_status_idx on public.book_ai_profiles (status);
create index if not exists book_ai_profiles_topics_gin_idx on public.book_ai_profiles using gin (topics);
create index if not exists book_ai_profiles_keywords_gin_idx on public.book_ai_profiles using gin (keywords);

-- Vector-индекс лучше создавать после появления данных и выбора метрики.
-- Пример для будущего этапа:
-- create index if not exists book_ai_profiles_embedding_hnsw_idx
--   on public.book_ai_profiles using hnsw (embedding vector_cosine_ops);

create index if not exists favorites_user_id_idx on public.favorites (user_id);
create index if not exists favorites_book_id_idx on public.favorites (book_id);

create index if not exists cart_items_user_id_idx on public.cart_items (user_id);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_desc_idx on public.orders (created_at desc);

create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_book_id_idx on public.order_items (book_id);

create index if not exists reviews_book_id_idx on public.reviews (book_id);
create index if not exists reviews_moderation_status_idx on public.reviews (moderation_status);

create index if not exists ai_analysis_jobs_book_id_idx on public.ai_analysis_jobs (book_id);
create index if not exists ai_analysis_jobs_status_idx on public.ai_analysis_jobs (status);
create index if not exists ai_analysis_jobs_created_at_desc_idx on public.ai_analysis_jobs (created_at desc);

create index if not exists user_events_user_created_at_desc_idx on public.user_events (user_id, created_at desc);
create index if not exists user_events_book_id_idx on public.user_events (book_id);
create index if not exists user_events_event_type_idx on public.user_events (event_type);
