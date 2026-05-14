-- Stage 17: AI-analysis lifecycle RLS baseline
-- Purpose: server-side AI analysis writes book_ai_profiles and ai_analysis_jobs.
-- Run after 15_admin_book_crud_rpc.sql and 19_orders_rpc_rls.sql.

alter table public.book_ai_profiles enable row level security;
alter table public.ai_analysis_jobs enable row level security;

-- Drop old draft constraints before normalizing statuses.
-- The old schema allowed pending/processing/error and queued/processing/error,
-- while Stage 17 uses stale/running/ready/failed.
alter table public.book_ai_profiles
  drop constraint if exists book_ai_profiles_status_check;

alter table public.ai_analysis_jobs
  drop constraint if exists ai_analysis_jobs_status_check;

-- Normalize statuses from the earlier draft schema to Stage 17 names.
update public.book_ai_profiles
set status = case status
  when 'pending' then 'stale'
  when 'processing' then 'running'
  when 'error' then 'failed'
  else status
end
where status in ('pending', 'processing', 'error');

update public.ai_analysis_jobs
set status = case status
  when 'queued' then 'running'
  when 'processing' then 'running'
  when 'error' then 'failed'
  else status
end
where status in ('queued', 'processing', 'error');

update public.book_ai_profiles
set status = 'stale'
where status not in ('stale', 'running', 'ready', 'failed');

update public.ai_analysis_jobs
set status = 'failed'
where status not in ('running', 'ready', 'failed');

alter table public.book_ai_profiles
  alter column status set default 'stale';

alter table public.ai_analysis_jobs
  alter column status set default 'running';

alter table public.book_ai_profiles
  add constraint book_ai_profiles_status_check
  check (status in ('stale', 'running', 'ready', 'failed'));

alter table public.ai_analysis_jobs
  add constraint ai_analysis_jobs_status_check
  check (status in ('running', 'ready', 'failed'));

-- Frontend roles may read according to RLS, but may not write analysis state directly.
grant select on public.book_ai_profiles to anon, authenticated;
grant select on public.ai_analysis_jobs to authenticated;
revoke insert, update, delete on public.book_ai_profiles from anon, authenticated;
revoke insert, update, delete on public.ai_analysis_jobs from anon, authenticated;

-- Replace broad/draft policies with read-only policies for browser clients.
drop policy if exists "Public can read ready AI profiles for active books" on public.book_ai_profiles;
drop policy if exists "Admins can manage AI profiles" on public.book_ai_profiles;
drop policy if exists "book_ai_profiles_select_ready_active" on public.book_ai_profiles;
drop policy if exists "book_ai_profiles_select_admin" on public.book_ai_profiles;
drop policy if exists "book_ai_profiles_insert_admin" on public.book_ai_profiles;
drop policy if exists "book_ai_profiles_update_admin" on public.book_ai_profiles;
drop policy if exists "book_ai_profiles_delete_admin" on public.book_ai_profiles;

create policy "book_ai_profiles_select_ready_active"
on public.book_ai_profiles
for select
to anon, authenticated
using (
  status = 'ready'
  and exists (
    select 1
    from public.books b
    where b.id = book_ai_profiles.book_id
      and b.is_active = true
  )
);

create policy "book_ai_profiles_select_admin"
on public.book_ai_profiles
for select
to authenticated
using (public.is_admin());

-- AI job logs are admin-only from browser clients. Writes are done by server-side function/service role.
drop policy if exists "ai_analysis_jobs_select_admin" on public.ai_analysis_jobs;
drop policy if exists "ai_analysis_jobs_insert_admin" on public.ai_analysis_jobs;
drop policy if exists "ai_analysis_jobs_update_admin" on public.ai_analysis_jobs;
drop policy if exists "ai_analysis_jobs_delete_admin" on public.ai_analysis_jobs;

create policy "ai_analysis_jobs_select_admin"
on public.ai_analysis_jobs
for select
to authenticated
using (public.is_admin());

-- Keep the existing Stage 12 function name for compatibility with admin_create_book/admin_update_book.
-- It now marks the AI profile as stale instead of the old pending status.
create or replace function public.admin_mark_book_ai_profile_pending(p_book_id uuid)
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
    'stale',
    now()
  )
  on conflict (book_id) do update
  set
    status = 'stale',
    updated_at = now();
end;
$$;

grant execute on function public.admin_mark_book_ai_profile_pending(uuid) to authenticated;

comment on table public.ai_analysis_jobs is
  'Stage 17: admin-visible job log for server-side AI analysis. Browser clients cannot write directly.';

comment on table public.book_ai_profiles is
  'Stage 17: semantic profiles created by server-side AI analysis. Public clients read ready active profiles; admins read all.';

comment on function public.admin_mark_book_ai_profile_pending(uuid) is
  'Stage 17 compatibility function: marks a book AI profile as stale when catalog text changes.';

-- Verification hints:
-- select book_id, status, updated_at from public.book_ai_profiles order by updated_at desc;
-- select id, book_id, status, started_at, finished_at, error_message from public.ai_analysis_jobs order by created_at desc;
-- Browser clients must call /api/analyze-book; direct INSERT/UPDATE on these tables should fail for anon/authenticated roles.
