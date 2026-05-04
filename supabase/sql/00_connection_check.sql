-- Optional Supabase SQL Editor sanity check
-- Run this in Supabase SQL Editor to verify SQL execution works.

select
  current_database() as database_name,
  current_schema() as schema_name,
  now() as checked_at;
