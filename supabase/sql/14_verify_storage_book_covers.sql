-- Stage 8 verification: book-covers Storage setup
-- This script only reads metadata and does not modify data.

select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
from storage.buckets
where id = 'book-covers';

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname ilike '%book covers%'
order by policyname;

select
  count(*) as stored_cover_objects
from storage.objects
where bucket_id = 'book-covers';
