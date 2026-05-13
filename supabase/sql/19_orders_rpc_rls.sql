-- Stage 16: Orders RPC and RLS baseline
-- Purpose: create orders safely from the authenticated user's cart.
-- Safe to run repeatedly after 01_schema.sql, auth/RLS scripts and 18_cart_items_rls.sql.

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Keep grants explicit for PostgREST/RPC. Direct write policies are intentionally
-- not exposed to authenticated clients: orders are created only by RPC so the
-- database can recalculate totals and persist snapshots from public.books.
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;

-- Remove broad/draft policies from earlier stages if they exist.
drop policy if exists "Пользователь видит свои заказы" on public.orders;
drop policy if exists "Users can read own orders" on public.orders;
drop policy if exists "orders_select_own_or_admin" on public.orders;
drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_update_admin" on public.orders;
drop policy if exists "orders_delete_admin" on public.orders;

drop policy if exists "Пользователь видит состав своих заказов" on public.order_items;
drop policy if exists "Users can read own order items" on public.order_items;
drop policy if exists "order_items_select_own_or_admin" on public.order_items;
drop policy if exists "order_items_insert_own" on public.order_items;
drop policy if exists "order_items_update_admin" on public.order_items;
drop policy if exists "order_items_delete_admin" on public.order_items;

create policy "orders_select_own_or_admin"
on public.orders
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "order_items_select_own_or_admin"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (o.user_id = auth.uid() or public.is_admin())
  )
);

create or replace function public.create_order_from_cart(
  p_delivery_type text,
  p_contact_json jsonb default '{}'::jsonb,
  p_comment text default null
)
returns table (
  id uuid,
  user_id uuid,
  status text,
  total_amount numeric,
  delivery_type text,
  contact_json jsonb,
  comment text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_delivery_type text := coalesce(nullif(trim(p_delivery_type), ''), 'pickup');
  v_contact_json jsonb := coalesce(p_contact_json, '{}'::jsonb);
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_cart_count integer;
  v_invalid_count integer;
  v_out_of_stock_count integer;
  v_total numeric(10,2);
begin
  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Требуется авторизация для оформления заказа.';
  end if;

  if v_delivery_type not in ('pickup', 'courier', 'digital') then
    raise exception using
      errcode = 'P0001',
      message = 'Выберите корректный способ получения заказа.';
  end if;

  if jsonb_typeof(v_contact_json) is distinct from 'object' then
    raise exception using
      errcode = 'P0001',
      message = 'Контактные данные должны быть JSON-объектом.';
  end if;

  select count(*)
    into v_cart_count
  from public.cart_items ci
  where ci.user_id = v_user_id;

  if v_cart_count = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Корзина пуста. Добавьте книги перед оформлением заказа.';
  end if;

  -- Lock cart rows and books for the duration of the transaction so stock cannot
  -- be consumed concurrently between validation and order creation.
  perform 1
  from public.cart_items ci
  join public.books b on b.id = ci.book_id
  where ci.user_id = v_user_id
  for update of ci, b;

  select count(*)
    into v_invalid_count
  from public.cart_items ci
  join public.books b on b.id = ci.book_id
  where ci.user_id = v_user_id
    and (b.is_active is not true or coalesce(b.stock_qty, 0) <= 0);

  if v_invalid_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'В корзине есть недоступные книги. Удалите их перед оформлением заказа.';
  end if;

  select count(*)
    into v_out_of_stock_count
  from public.cart_items ci
  join public.books b on b.id = ci.book_id
  where ci.user_id = v_user_id
    and ci.quantity > coalesce(b.stock_qty, 0);

  if v_out_of_stock_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Количество одной или нескольких книг превышает доступный остаток.';
  end if;

  select coalesce(sum((b.price * ci.quantity)::numeric), 0)::numeric(10,2)
    into v_total
  from public.cart_items ci
  join public.books b on b.id = ci.book_id
  where ci.user_id = v_user_id;

  insert into public.orders (user_id, status, total_amount, delivery_type, contact_json, comment)
  values (v_user_id, 'created', v_total, v_delivery_type, v_contact_json, v_comment)
  returning public.orders.id into v_order_id;

  insert into public.order_items (order_id, book_id, title_snapshot, price_snapshot, quantity)
  select
    v_order_id,
    b.id,
    b.title,
    b.price,
    ci.quantity
  from public.cart_items ci
  join public.books b on b.id = ci.book_id
  where ci.user_id = v_user_id;

  update public.books b
  set
    stock_qty = b.stock_qty - ci.quantity,
    updated_at = now()
  from public.cart_items ci
  where ci.user_id = v_user_id
    and ci.book_id = b.id;

  delete from public.cart_items ci
  where ci.user_id = v_user_id;

  return query
  select
    o.id,
    o.user_id,
    o.status,
    o.total_amount,
    o.delivery_type,
    o.contact_json,
    o.comment,
    o.created_at,
    o.updated_at
  from public.orders o
  where o.id = v_order_id;
end;
$$;

create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status text
)
returns table (
  id uuid,
  user_id uuid,
  status text,
  total_amount numeric,
  delivery_type text,
  contact_json jsonb,
  comment text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := coalesce(nullif(trim(p_status), ''), '');
begin
  if public.is_admin() is not true then
    raise exception using
      errcode = 'P0001',
      message = 'Недостаточно прав для изменения статуса заказа.';
  end if;

  if v_status not in ('created', 'processing', 'completed', 'cancelled') then
    raise exception using
      errcode = 'P0001',
      message = 'Некорректный статус заказа.';
  end if;

  return query
  update public.orders o
  set
    status = v_status,
    updated_at = now()
  where o.id = p_order_id
  returning
    o.id,
    o.user_id,
    o.status,
    o.total_amount,
    o.delivery_type,
    o.contact_json,
    o.comment,
    o.created_at,
    o.updated_at;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Заказ не найден.';
  end if;
end;
$$;

comment on function public.create_order_from_cart(text, jsonb, text) is
  'Stage 16: safely creates an order from auth.uid() cart, recalculates total from books.price, writes snapshots, decrements stock and clears cart.';

comment on function public.admin_update_order_status(uuid, text) is
  'Stage 16: admin-only RPC for changing order status without exposing direct UPDATE permissions.';

revoke all on function public.create_order_from_cart(text, jsonb, text) from public, anon;
revoke all on function public.admin_update_order_status(uuid, text) from public, anon;
grant execute on function public.create_order_from_cart(text, jsonb, text) to authenticated;
grant execute on function public.admin_update_order_status(uuid, text) to authenticated;

comment on table public.orders is 'Stage 16: orders created only through create_order_from_cart RPC; users read own rows, admins read all rows.';
comment on table public.order_items is 'Stage 16: order item snapshots; users read items of own orders, admins read all items.';

-- Verification hints:
-- select id, user_id, status, total_amount, delivery_type, contact_json, created_at from public.orders order by created_at desc;
-- select order_id, book_id, title_snapshot, price_snapshot, quantity from public.order_items order by created_at desc;
-- RLS behavior is best verified through the app under two different authenticated users and one admin user.
