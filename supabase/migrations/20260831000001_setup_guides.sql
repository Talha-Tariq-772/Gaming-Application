-- Structured, DB-backed setup guides for account-credential products —
-- distinct from the mock general-help "guides" (src/lib/mock-guides.ts,
-- getting-started/payment/account-setup/troubleshooting categories), which
-- stay mock this session. These are specifically platform/product-type
-- instructions a game or membership row links to via games.setup_guide_id
-- (column added, uncommented, in 20260829000002_games_catalog_columns.sql —
-- that migration's comment said "the guides table this will reference does
-- not exist as of this migration. Populated in a later session." — this is
-- that session).
create table public.setup_guides (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  -- Markdown source — rendered through src/lib/markdown.ts, same as the
  -- mock guides/news_posts, never dangerouslySetInnerHTML'd directly.
  body text not null,
  -- Same enum as games.platform (games_platform_check,
  -- 20260829000002_games_catalog_columns.sql). Nullable: a guide that
  -- isn't platform-specific (e.g. the membership guide, which covers both
  -- the PlayStation console-sharing method and the separate Xbox Game Pass
  -- sign-in method in one document) has no single platform to record.
  platform text check (platform is null or platform in ('ps4', 'ps5', 'ps4_ps5', 'xbox')),
  product_type text not null default 'game' check (product_type in ('game', 'membership')),
  sort_order smallint not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_setup_guides_published on public.setup_guides (product_type, sort_order) where is_published = true;

alter table public.setup_guides enable row level security;

-- Admins also see unpublished drafts (needed by any future admin UI) —
-- same shape as news_posts_select (20260822000001_news_posts.sql).
create policy "setup_guides_select" on public.setup_guides
  for select
  using (is_published = true or public.current_profile_role() = 'admin');

create policy "setup_guides_admin_all" on public.setup_guides
  for all
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

grant select on public.setup_guides to anon;
grant select, insert, update, delete on public.setup_guides to authenticated;
grant all on public.setup_guides to service_role;

alter table public.games
  add constraint games_setup_guide_id_fkey foreign key (setup_guide_id) references public.setup_guides (id);
