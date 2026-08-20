create table public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  price numeric(10, 2) not null check (price > 0),
  cover_image_url text,
  trailer_url text,
  genre text,
  platform text,
  setup_guide text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

-- Admins also see inactive games (needed by the admin catalog UI).
create policy "games_select" on public.games
  for select
  using (is_active = true or public.current_profile_role() = 'admin');

create policy "games_admin_insert" on public.games
  for insert
  with check (public.current_profile_role() = 'admin');

create policy "games_admin_update" on public.games
  for update
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

create policy "games_admin_delete" on public.games
  for delete
  using (public.current_profile_role() = 'admin');
