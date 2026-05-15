-- Stage 18: User events RLS and event-type normalization
-- Purpose: safe client-side logging of minimal behavioral events for future recommendations.
-- Run after 20_ai_analysis_lifecycle.sql. Safe to run repeatedly.

alter table public.user_events enable row level security;

-- The early schema used event_type = 'view'. Stage 18 standardizes the public
-- contract to 'book_view', so older rows and the check constraint are normalized.
alter table public.user_events
  drop constraint if exists user_events_event_type_check;

update public.user_events
set event_type = 'book_view'
where event_type = 'view';

alter table public.user_events
  add constraint user_events_event_type_check
  check (
    event_type in (
      'book_view',
      'search',
      'favorite_add',
      'favorite_remove',
      'cart_add',
      'cart_remove',
      'purchase',
      'recommendation_click'
    )
  );

-- Keep payloads intentionally small. Stage 18 events are for recommendations and
-- analytics, not for storing contact data, raw forms, JWTs, emails or full traces.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_events_payload_size_check'
      and conrelid = 'public.user_events'::regclass
  ) then
    alter table public.user_events
      add constraint user_events_payload_size_check
      check (octet_length(event_payload::text) <= 4096);
  end if;
end $$;

-- Browser clients may only insert events and authenticated users may read only
-- their own events. Updates and deletes are intentionally not available.
grant insert on public.user_events to anon, authenticated;
grant select on public.user_events to authenticated;
revoke update, delete on public.user_events from anon, authenticated;
revoke select on public.user_events from anon;

-- Remove broad/draft policies from earlier stages if they exist.
drop policy if exists "Пользователь управляет своими событиями" on public.user_events;
drop policy if exists "Users can manage own events" on public.user_events;
drop policy if exists "user_events_select_own" on public.user_events;
drop policy if exists "user_events_insert_own" on public.user_events;
drop policy if exists "user_events_insert_guest" on public.user_events;
drop policy if exists "user_events_insert_authenticated_or_guest" on public.user_events;
drop policy if exists "user_events_update_own" on public.user_events;
drop policy if exists "user_events_delete_own" on public.user_events;

create policy "user_events_select_own"
on public.user_events
for select
to authenticated
using (user_id = auth.uid());

create policy "user_events_insert_own"
on public.user_events
for insert
to authenticated
with check (user_id = auth.uid());

create policy "user_events_insert_guest"
on public.user_events
for insert
to anon
with check (user_id is null);

comment on table public.user_events is
  'Stage 18: minimal user behavior log for future recommendations. Authenticated users insert/read only own rows; guests can insert anonymous rows with user_id null; browser clients cannot update/delete.';

comment on column public.user_events.event_payload is
  'Minimal JSON payload only: book_id, quantity, query, order_id or recommendation_id. Do not store email, phone, address, tokens or full form data.';

-- Verification hints:
-- Auth user: book_view/search/favorite/cart/purchase events should insert with user_id = auth.uid().
-- Guest: book_view/search can insert with user_id is null, but SELECT from anon is denied.
-- Negative tests: authenticated insert with another user_id, UPDATE and DELETE should fail under RLS/grants.
