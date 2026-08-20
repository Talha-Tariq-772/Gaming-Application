create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  status text not null default 'awaiting_payment' check (
    status in ('awaiting_payment', 'payment_claimed', 'under_review', 'approved', 'rejected', 'expired')
  ),
  payment_reference text unique not null,
  amount_exact numeric(10, 2) not null,
  payment_method_id uuid references public.payment_methods (id),
  claimed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  rejection_reason text,
  reserved_until timestamptz,
  created_at timestamptz not null default now()
);

create index idx_orders_user_id on public.orders (user_id);

alter table public.orders enable row level security;

create policy "orders_select" on public.orders
  for select
  using (user_id = auth.uid() or public.current_profile_role() in ('agent', 'admin'));

create policy "orders_insert_own" on public.orders
  for insert
  with check (user_id = auth.uid());

-- Deliberately no UPDATE policy for any client role, staff included. Status
-- transitions (claim, approve, reject, expire) only happen through server
-- code using the service role, which bypasses RLS and needs no policy.
