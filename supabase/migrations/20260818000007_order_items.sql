create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  game_id uuid not null references public.games (id),
  credential_id uuid references public.game_credentials (id),
  price numeric(10, 2) not null
);

create index idx_order_items_order_id on public.order_items (order_id);

alter table public.order_items enable row level security;

create policy "order_items_select" on public.order_items
  for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or public.current_profile_role() in ('agent', 'admin'))
    )
  );

-- No insert/update/delete policies: order items are created and mutated
-- only by server code using the service role.
