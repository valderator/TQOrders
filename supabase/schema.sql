-- =============================================================
-- Turquoise Orders – Supabase schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: everything is idempotent.
-- =============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ tables

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'employee' check (role in ('admin', 'employee')),
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table if not exists public.floors (
  id          text primary key,
  name        text not null,
  sort_order  int  not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.dining_tables (
  id          text primary key,
  name        text not null,
  floor_id    text references public.floors (id) on delete cascade,
  x           double precision not null default 0.05,
  y           double precision not null default 0.05,
  w           double precision not null default 0.32,
  h           double precision not null default 0.10,
  seats       int  not null default 4,
  sort_order  int  not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.menu_items (
  id          text primary key,
  name        text not null,
  price       numeric(10, 2) not null default 0,
  category    text not null default 'Other',
  available   boolean not null default true,
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.open_orders (
  id          text primary key,
  table_id    text not null,
  note        text default '',
  started_at  timestamptz not null default now(),
  opened_by   uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.order_items (
  id            text primary key,
  order_id      text,
  table_id      text not null,
  menu_item_id  text,
  name          text not null,
  price         numeric(10, 2) not null default 0,
  quantity      int not null default 1,
  note          text default '',
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.order_history (
  id              text primary key,
  table_id        text,
  table_name      text,
  floor_id        text,
  items           jsonb not null default '[]'::jsonb,
  order_note      text default '',
  started_at      timestamptz not null default now(),
  finished_at     timestamptz not null default now(),
  day             date,
  total_price     numeric(10, 2) not null default 0,
  payment_method  text default 'cash',
  served_by       uuid references public.profiles (id) on delete set null,
  served_by_name  text,
  updated_at      timestamptz not null default now()
);

create table if not exists public.shifts (
  id          text primary key,
  user_id     uuid references public.profiles (id) on delete cascade,
  user_name   text,
  clock_in    timestamptz not null default now(),
  clock_out   timestamptz,
  day         date,
  note        text default '',
  updated_at  timestamptz not null default now()
);

create index if not exists order_items_table_idx  on public.order_items (table_id);
create index if not exists order_history_day_idx  on public.order_history (day desc);
create index if not exists order_history_user_idx on public.order_history (served_by);
create index if not exists shifts_user_day_idx    on public.shifts (user_id, day desc);

-- --------------------------------------------------------------- utilities

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'floors', 'dining_tables', 'menu_items',
    'open_orders', 'order_items', 'order_history', 'shifts'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before insert or update on public.%I
       for each row execute function public.touch_updated_at()', t);
  end loop;
end;
$$;

-- Role check used by every policy. SECURITY DEFINER avoids recursive RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.active
  );
$$;

-- Every new auth user gets an employee profile automatically. The role is never
-- taken from client-supplied metadata; an admin promotes accounts afterwards.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    'employee'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Employees may edit their own name but never their role or active flag.
-- auth.uid() is NULL for direct SQL / service_role access, which RLS already
-- gates, so those callers are let through.
create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role or new.active is distinct from old.active then
    raise exception 'Only administrators can change roles or account status';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- --------------------------------------------------------------------- RLS

alter table public.profiles       enable row level security;
alter table public.floors         enable row level security;
alter table public.dining_tables  enable row level security;
alter table public.menu_items     enable row level security;
alter table public.open_orders    enable row level security;
alter table public.order_items    enable row level security;
alter table public.order_history  enable row level security;
alter table public.shifts         enable row level security;

do $$
declare t text; p record;
begin
  foreach t in array array[
    'profiles', 'floors', 'dining_tables', 'menu_items',
    'open_orders', 'order_items', 'order_history', 'shifts'
  ] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end;
$$;

-- Everyone signed in can read the shared operational data.
create policy read_all on public.profiles      for select to authenticated using (true);
create policy read_all on public.floors        for select to authenticated using (true);
create policy read_all on public.dining_tables for select to authenticated using (true);
create policy read_all on public.menu_items    for select to authenticated using (true);
create policy read_all on public.open_orders   for select to authenticated using (true);
create policy read_all on public.order_items   for select to authenticated using (true);
create policy read_all on public.order_history for select to authenticated using (true);
create policy read_all on public.shifts        for select to authenticated using (true);

-- Profiles: self-service name changes, admins manage everyone.
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.is_admin());

-- Catalogue and layout: administrators only.
create policy floors_write on public.floors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy tables_write on public.dining_tables for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy menu_write on public.menu_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Live service: any active staff member.
create policy open_orders_write on public.open_orders for all to authenticated
  using (true) with check (true);
create policy order_items_write on public.order_items for all to authenticated
  using (true) with check (true);

-- History: staff can archive orders, only admins can rewrite or delete them.
create policy history_insert on public.order_history for insert to authenticated
  with check (true);
create policy history_update on public.order_history for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy history_delete on public.order_history for delete to authenticated
  using (public.is_admin());

-- Shifts: staff clock themselves in/out, admins manage all attendance.
create policy shifts_insert on public.shifts for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());
create policy shifts_update on public.shifts for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy shifts_delete on public.shifts for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------- realtime

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'floors', 'dining_tables', 'menu_items',
    'open_orders', 'order_items', 'order_history', 'shifts'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end;
$$;

-- ------------------------------------------------------------ first admin
-- After creating your first user in Authentication → Users, run:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
