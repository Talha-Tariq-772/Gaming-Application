-- Public catalog-image buckets. Product art isn't sensitive, so reads are
-- public; writes are restricted to admins via storage.objects policies,
-- matching the current_profile_role() RLS style used on public.games. The
-- one-off upload script (scripts/upload-catalog-images.mjs) uses the
-- service-role key and bypasses these policies entirely, same as every
-- other service-role write path in this project — they exist for the
-- future in-app admin upload flow, not for that script.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('game-images', 'game-images', true, 10485760, array['image/webp', 'image/jpeg', 'image/png']),
  ('membership-images', 'membership-images', true, 10485760, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- RLS is already enabled on storage.objects in every Supabase environment
-- (the platform owns and enables it; local CLI and hosted alike) — no
-- ALTER here. The migration role can't own that table in any environment,
-- so an explicit "ENABLE ROW LEVEL SECURITY" can only no-op or hard-fail
-- with "must be owner of table objects" (confirmed the hard-fail case
-- against the local CLI stack). Policies are the supported path and don't
-- need ownership.
create policy "game_images_select" on storage.objects
  for select
  using (bucket_id = 'game-images');

create policy "game_images_admin_insert" on storage.objects
  for insert
  with check (bucket_id = 'game-images' and public.current_profile_role() = 'admin');

create policy "game_images_admin_update" on storage.objects
  for update
  using (bucket_id = 'game-images' and public.current_profile_role() = 'admin')
  with check (bucket_id = 'game-images' and public.current_profile_role() = 'admin');

create policy "game_images_admin_delete" on storage.objects
  for delete
  using (bucket_id = 'game-images' and public.current_profile_role() = 'admin');

create policy "membership_images_select" on storage.objects
  for select
  using (bucket_id = 'membership-images');

create policy "membership_images_admin_insert" on storage.objects
  for insert
  with check (bucket_id = 'membership-images' and public.current_profile_role() = 'admin');

create policy "membership_images_admin_update" on storage.objects
  for update
  using (bucket_id = 'membership-images' and public.current_profile_role() = 'admin')
  with check (bucket_id = 'membership-images' and public.current_profile_role() = 'admin');

create policy "membership_images_admin_delete" on storage.objects
  for delete
  using (bucket_id = 'membership-images' and public.current_profile_role() = 'admin');
