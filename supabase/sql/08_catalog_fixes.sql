-- Stage 7: catalog schema safety fixes
-- Safe, rerunnable helpers for catalog data. No destructive commands.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Authors are seeded by full_name in Stage 7, so a unique constraint keeps seed rerunnable.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'authors_full_name_key'
      and conrelid = 'public.authors'::regclass
  ) then
    alter table public.authors
      add constraint authors_full_name_key unique (full_name);
  end if;
end $$;

-- Ensure key catalog columns exist if an older schema was applied.
alter table public.books add column if not exists is_active boolean not null default true;
alter table public.books add column if not exists stock_qty int not null default 0;
alter table public.books add column if not exists rating numeric(3,2) not null default 0;
alter table public.books add column if not exists cover_url text;
alter table public.books add column if not exists format text not null default 'paper';
alter table public.books add column if not exists updated_at timestamptz not null default now();

alter table public.book_ai_profiles add column if not exists topics jsonb not null default '[]'::jsonb;
alter table public.book_ai_profiles add column if not exists keywords jsonb not null default '[]'::jsonb;
alter table public.book_ai_profiles add column if not exists status text not null default 'pending';
alter table public.book_ai_profiles add column if not exists updated_at timestamptz not null default now();
