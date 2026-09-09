-- Phone+password auth. Supabase has no phone+password provider without SMS
-- (cost), so signup/login map the normalised phone to a synthetic internal
-- email (see src/lib/phone.ts's phoneToAuthEmail) and go through the
-- ordinary email+password grant against that address. profiles.phone_number
-- (unique, already exists) is untouched by this migration — it keeps
-- storing validation.ts's spaced canonical form, same as the existing
-- Google + /complete-profile path.
--
-- Down-migration (reversible, not applied — for the record):
--   drop function if exists public.check_login_rate_limit(text, text);
--   drop table if exists public.login_attempts;
--   alter table public.profiles drop column if exists password_reset_requested_at;
--   alter table public.profiles drop column if exists recovery_email;

-- Optional — only meaningful for the "recovery email on file" reset path
-- (STEP 4). Deliberately separate from auth.users.email, which is always
-- the synthetic address for a phone+password account and must never be
-- shown to or collected from the user as their "real" email.
alter table public.profiles add column recovery_email text;

-- Set by the no-recovery-email reset request form; cleared once an admin
-- fulfils the request from /admin/resets. Presence of a non-null value is
-- exactly what makes a profile show up in that queue.
alter table public.profiles add column password_reset_requested_at timestamptz;

-- One row per signup/login attempt, phone+IP both recorded so either limit
-- can be checked independently. No FK to profiles/auth.users — an attempt
-- against a phone number that turns out not to exist (or a signup attempt,
-- which has no user yet) must still count towards the limit, which is the
-- whole point of rate-limiting the attempt itself rather than a resource
-- that may not exist yet.
create table public.login_attempts (
  id bigint generated always as identity primary key,
  phone text not null,
  ip text not null,
  created_at timestamptz not null default now()
);

create index idx_login_attempts_phone_created on public.login_attempts (phone, created_at);
create index idx_login_attempts_ip_created on public.login_attempts (ip, created_at);

alter table public.login_attempts enable row level security;
-- No policies for anon/authenticated — checked and written only by
-- check_login_rate_limit (security definer, service-role callers only),
-- same "RLS enabled + zero policies + explicit revoke" shape as
-- game_credentials/gift_card_codes.
revoke all on public.login_attempts from anon, authenticated;
grant all on public.login_attempts to service_role;

-- Checks both limits (5 / phone / 15 min, 20 / IP / hour) BEFORE recording
-- the attempt, so a caller already over a limit is rejected without ever
-- inserting another row — the 6th attempt in a phone's window is blocked
-- outright, not counted-then-blocked. Returns true (and records the
-- attempt) when both limits still have room; false (and records nothing)
-- otherwise. Every phone/login/signup server action must call this before
-- doing anything else with the attempt.
create or replace function public.check_login_rate_limit(p_phone text, p_ip text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone_count int;
  v_ip_count int;
begin
  select count(*) into v_phone_count
  from public.login_attempts
  where phone = p_phone and created_at > now() - interval '15 minutes';

  select count(*) into v_ip_count
  from public.login_attempts
  where ip = p_ip and created_at > now() - interval '1 hour';

  if v_phone_count >= 5 or v_ip_count >= 20 then
    return false;
  end if;

  insert into public.login_attempts (phone, ip) values (p_phone, p_ip);
  return true;
end;
$$;

revoke all on function public.check_login_rate_limit(text, text) from public;
grant execute on function public.check_login_rate_limit(text, text) to service_role;
