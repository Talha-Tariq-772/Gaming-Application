create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index idx_audit_log_actor_id on public.audit_log (actor_id);

alter table public.audit_log enable row level security;

create policy "audit_log_select_admin" on public.audit_log
  for select
  using (public.current_profile_role() = 'admin');

-- No insert/update/delete policies: writes happen only via the service
-- role, which bypasses RLS. The log is otherwise immutable to every client.
