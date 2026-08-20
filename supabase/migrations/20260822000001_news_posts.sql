create table public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  excerpt text,
  body text not null,
  cover_image_url text,
  is_published boolean not null default false,
  published_at timestamptz,
  author_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index idx_news_posts_published on public.news_posts (published_at desc) where is_published = true;

alter table public.news_posts enable row level security;

-- Admins also see unpublished drafts (needed by any future admin UI).
create policy "news_posts_select" on public.news_posts
  for select
  using (is_published = true or public.current_profile_role() = 'admin');

create policy "news_posts_admin_insert" on public.news_posts
  for insert
  with check (public.current_profile_role() = 'admin');

create policy "news_posts_admin_update" on public.news_posts
  for update
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

create policy "news_posts_admin_delete" on public.news_posts
  for delete
  using (public.current_profile_role() = 'admin');

-- Table created via a fresh migration push doesn't inherit the grants
-- Supabase's dashboard sets up for a project's initial schema (learned the
-- hard way in an earlier migration) — explicit grants required, RLS alone
-- isn't enough since Postgres checks table-level grants first.
grant select, insert, update, delete on public.news_posts to authenticated;
grant select on public.news_posts to anon;
grant all on public.news_posts to service_role;
