-- Stage 15: cart_items RLS and integrity baseline
-- Purpose: authenticated users can manage only their own cart rows.
-- Safe to run repeatedly after the base schema and auth/RLS scripts.

alter table public.cart_items enable row level security;

-- Ensure one row per user/book and positive quantity. These constraints exist in the
-- base schema, but the guards make this script safe for projects restored from older stages.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cart_items_user_book_unique'
      and conrelid = 'public.cart_items'::regclass
  ) then
    alter table public.cart_items
      add constraint cart_items_user_book_unique unique (user_id, book_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cart_items_quantity_check'
      and conrelid = 'public.cart_items'::regclass
  ) then
    alter table public.cart_items
      add constraint cart_items_quantity_check check (quantity > 0);
  end if;
end $$;

-- Remove policies from earlier draft stages if they exist.
drop policy if exists "Пользователь управляет своей корзиной" on public.cart_items;
drop policy if exists "Users can manage own cart" on public.cart_items;
drop policy if exists "cart_items_select_own" on public.cart_items;
drop policy if exists "cart_items_insert_own" on public.cart_items;
drop policy if exists "cart_items_update_own" on public.cart_items;
drop policy if exists "cart_items_delete_own" on public.cart_items;

create policy "cart_items_select_own"
on public.cart_items
for select
to authenticated
using (user_id = auth.uid());

create policy "cart_items_insert_own"
on public.cart_items
for insert
to authenticated
with check (user_id = auth.uid());

create policy "cart_items_update_own"
on public.cart_items
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "cart_items_delete_own"
on public.cart_items
for delete
to authenticated
using (user_id = auth.uid());

comment on table public.cart_items is 'Stage 15: user-owned shopping cart rows; protected by owner-only RLS.';

-- Verification hints:
-- select id, user_id, book_id, quantity, created_at, updated_at from public.cart_items order by updated_at desc;
-- In the app, verify user A cannot see or modify user B cart rows.
