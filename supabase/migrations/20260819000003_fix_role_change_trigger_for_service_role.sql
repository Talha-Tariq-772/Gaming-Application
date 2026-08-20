-- prevent_unauthorized_role_change() required current_profile_role() =
-- 'admin' for ANY role change — but that resolves against auth.uid(),
-- which is NULL for a service-role connection (no JWT/session context).
-- That silently blocked the service role from ever promoting anyone to
-- admin, with no other path to create a project's first admin at all.
-- Service-role callers are already fully trusted by definition (that's
-- the entire point of the key), so they bypass this check; a regular
-- authenticated user still needs to already be admin to change any role.
create or replace function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.role() = 'service_role' then
      return new;
    end if;
    if public.current_profile_role() is distinct from 'admin' then
      raise exception 'Only admins can change role';
    end if;
  end if;
  return new;
end;
$$;
