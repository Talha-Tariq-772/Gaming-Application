-- profiles: one row per auth.users, holds app-level identity + role.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone_number text unique,
  phone_verified boolean not null default false,
  role text not null default 'customer' check (role in ('customer', 'agent', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Bypasses RLS by design: policies on profiles call this to check the
-- caller's role without recursing back into the very policy being evaluated.
create or replace function public.current_profile_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone_number)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone_number'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role changes require the ACTOR to already be admin, regardless of which
-- row is being updated or what the RLS UPDATE policy otherwise allows.
create or replace function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if public.current_profile_role() is distinct from 'admin' then
      raise exception 'Only admins can change role';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_unauthorized_role_change();

create policy "profiles_select" on public.profiles
  for select
  using (id = auth.uid() or public.current_profile_role() in ('agent', 'admin'));

create policy "profiles_insert_own" on public.profiles
  for insert
  with check (id = auth.uid());

-- Row-level access here is deliberately permissive for admins (any row) and
-- self (own row); the trigger above is what actually blocks role escalation.
create policy "profiles_update" on public.profiles
  for update
  using (id = auth.uid() or public.current_profile_role() = 'admin')
  with check (id = auth.uid() or public.current_profile_role() = 'admin');
