-- Admin-managed art for gift-card products.
--
-- No new COLUMNS: gift_card_products already carries card_image_url and
-- header_image_url (20260901000002_gift_cards.sql), both plain text URL
-- columns that have been null on every row since seeding. This migration
-- only adds the bucket those URLs will point at, so an admin can upload,
-- replace and remove art through the panel instead of the columns staying
-- permanently empty.
--
-- Why store a public URL rather than a path prefix, the way games do:
-- games' cover_path/wallpaper_path exist because a game has SEVERAL
-- derivative widths behind one prefix (storage-image.ts rebuilds
-- "-400.webp"/"-800.webp" from it). A gift card renders one card face and
-- one banner, each at a single size, and lib/product-image.ts's
-- getGiftCardImage already treats card_image_url as an absolute-URL
-- override that wins outright. Writing the public URL straight into that
-- column means the existing resolution chain (admin override ->
-- per-platform art -> placeholder) needs no new branch at all, and
-- clearing the column to NULL restores the fallback for free.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('gift-card-images', 'gift-card-images', true, 10485760, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Policies mirror game_images_* (20260829000001_storage_buckets.sql)
-- exactly: public read (product art is not sensitive), admin-only writes.
-- As with those, the in-app upload path uses the service-role key and
-- bypasses these entirely — they are the backstop for any client-role
-- access, not the mechanism the admin panel relies on.
--
-- RLS is already enabled on storage.objects by the platform in every
-- environment; no ALTER here (the migration role cannot own that table).
create policy "gift_card_images_select" on storage.objects
  for select
  using (bucket_id = 'gift-card-images');

create policy "gift_card_images_admin_insert" on storage.objects
  for insert
  with check (bucket_id = 'gift-card-images' and public.current_profile_role() = 'admin');

create policy "gift_card_images_admin_update" on storage.objects
  for update
  using (bucket_id = 'gift-card-images' and public.current_profile_role() = 'admin')
  with check (bucket_id = 'gift-card-images' and public.current_profile_role() = 'admin');

create policy "gift_card_images_admin_delete" on storage.objects
  for delete
  using (bucket_id = 'gift-card-images' and public.current_profile_role() = 'admin');
