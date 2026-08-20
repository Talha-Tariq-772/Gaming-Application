alter table public.profiles add column email text;

-- Google OAuth sign-ins populate auth.users.email directly (unlike
-- full_name/phone_number, which only ever come from raw_user_meta_data).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone_number, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone_number',
    new.email
  );
  return new;
end;
$$;
