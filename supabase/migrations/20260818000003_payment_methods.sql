create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  account_title text not null,
  account_number text not null,
  iban text,
  raast_id text,
  instructions text,
  is_active boolean not null default true,
  sort_order int not null default 0
);

alter table public.payment_methods enable row level security;

create policy "payment_methods_select" on public.payment_methods
  for select
  using (is_active = true or public.current_profile_role() = 'admin');

create policy "payment_methods_admin_insert" on public.payment_methods
  for insert
  with check (public.current_profile_role() = 'admin');

create policy "payment_methods_admin_update" on public.payment_methods
  for update
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

create policy "payment_methods_admin_delete" on public.payment_methods
  for delete
  using (public.current_profile_role() = 'admin');
