-- In-app payment screenshots, replacing the WhatsApp screenshot handoff.
--
-- Three pieces:
--   1. orders.lookup_token — a long random bearer token per order, so a
--      GUEST (who has no login) can return to their own order later.
--   2. payment_screenshots — one current screenshot per order, pointing at
--      a PRIVATE storage object.
--   3. An approval gate: approve_order refuses an order with no screenshot.
--
-- The WhatsApp handoff itself is untouched as a support channel; what goes
-- is its role as the delivery route for payment evidence.

-- ---------------------------------------------------------------------
-- 1. Guest lookup token
-- ---------------------------------------------------------------------
--
-- Deliberately NOT payment_reference. That is 'PSC-' plus 6 characters
-- from generate_unique_payment_reference() — it is printed on screen, read
-- aloud, and pasted into chats, and a 6-char space is brute-forceable.
-- Gating access to someone's payment evidence on it would be a real
-- enumeration hole. 32 random bytes (64 hex chars) is a bearer token, and
-- is treated as one: it never appears in a page title, a log line, or an
-- analytics event.
--
-- Issued for EVERY order, not just guest ones. A logged-in buyer never
-- needs it (their order page is behind their session), but generating it
-- unconditionally means there is no branch that can forget to, and no
-- backfill needed if a guest order is ever converted to an account.
alter table public.orders
  add column lookup_token text not null default encode(gen_random_bytes(32), 'hex');

-- Unique so a lookup is an exact single-row match, and indexed because
-- /order-status/<token> queries by it on every page load.
create unique index idx_orders_lookup_token on public.orders (lookup_token);

comment on column public.orders.lookup_token is
  'Bearer token for the no-login /order-status/<token> page. NOT the human-readable payment_reference — see 20260921000005_payment_screenshots.sql. Never log or expose it anywhere but the order owner''s own link.';

-- Existing rows got the default, which is exactly what we want (each gets
-- its own distinct token, because the default is volatile per row).

-- ---------------------------------------------------------------------
-- 2. The screenshot record
-- ---------------------------------------------------------------------

create table public.payment_screenshots (
  id uuid primary key default gen_random_uuid(),
  -- ON DELETE CASCADE: a deleted order has no evidence worth keeping, and
  -- the tests delete orders routinely. The storage OBJECT is cleaned up by
  -- application code, which is the one thing a cascade cannot do.
  order_id uuid not null references public.orders (id) on delete cascade,
  -- Object path inside the private payment-screenshots bucket.
  storage_path text not null,
  content_type text not null,
  byte_size integer not null check (byte_size > 0),
  uploaded_at timestamptz not null default now(),
  -- ONE current screenshot per order. Re-uploading replaces the row (and
  -- overwrites the object at the same path), which is what "the customer
  -- uploaded the wrong image" needs — not an ever-growing pile of
  -- half-right evidence for an admin to pick through.
  unique (order_id)
);

create index idx_payment_screenshots_order on public.payment_screenshots (order_id);

alter table public.payment_screenshots enable row level security;

-- Deliberately NO policy for anon or authenticated, and no grants to
-- either — the same shape game_credentials and cost_price_history use.
-- Every read and write goes through the service role behind a server
-- action that has already checked either the session owner or the lookup
-- token. A buyer must not be able to enumerate this table directly, and an
-- admin reads it through the service client like everything else.
--
-- Supabase's bootstrap grants table privileges to anon/authenticated by
-- default, so "RLS on, no policy" would still leave them SELECT privilege
-- and merely zero visible rows. Revoke explicitly so the answer is a hard
-- permission error.
revoke all on public.payment_screenshots from anon, authenticated;
grant all on public.payment_screenshots to service_role;

-- ---------------------------------------------------------------------
-- 3. The bucket — PRIVATE, unlike every other bucket in this project
-- ---------------------------------------------------------------------
--
-- game-images / membership-images / gift-card-images are all public:
-- product art is marketing material. A payment screenshot is the
-- opposite — it shows a real person's banking app, their name, often their
-- balance. public = false means there is no public URL at all; reads go
-- through a signed URL minted server-side for an admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('payment-screenshots', 'payment-screenshots', false, 10485760,
   array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- READ: admins only. No anon policy, no owner policy — a buyer does not
-- need to re-read their own upload (the UI shows "received", not the
-- image), and not granting it means a leaked object path is inert.
create policy "payment_screenshots_admin_select" on storage.objects
  for select
  using (bucket_id = 'payment-screenshots' and public.current_profile_role() = 'admin');

-- WRITE: the order's own signed-in owner, or an admin.
--
-- Objects are stored at '<order_id>/...', so the first path segment is the
-- order id — that is what ties a write to a row we can check ownership on.
-- storage.foldername() returns the path segments; [1] is the first.
--
-- A GUEST cannot be expressed here: they have no session for auth.uid() to
-- resolve, and a bearer token is not visible to a storage policy. Guest
-- uploads therefore go through the server action, which checks the token
-- itself. That action uses the service role and bypasses these policies
-- entirely — as does the logged-in path, for consistency. These policies
-- are the backstop for any future direct-from-browser upload, not the
-- mechanism the app relies on today. The real boundary is
-- src/lib/actions/payment-screenshots.ts.
create policy "payment_screenshots_owner_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'payment-screenshots'
    and (
      public.current_profile_role() = 'admin'
      or exists (
        select 1 from public.orders o
        where o.id::text = (storage.foldername(name))[1]
          and o.user_id = auth.uid()
      )
    )
  );

create policy "payment_screenshots_owner_update" on storage.objects
  for update
  using (
    bucket_id = 'payment-screenshots'
    and (
      public.current_profile_role() = 'admin'
      or exists (
        select 1 from public.orders o
        where o.id::text = (storage.foldername(name))[1]
          and o.user_id = auth.uid()
      )
    )
  );

create policy "payment_screenshots_admin_delete" on storage.objects
  for delete
  using (bucket_id = 'payment-screenshots' and public.current_profile_role() = 'admin');

-- ---------------------------------------------------------------------
-- 4. No screenshot, no approval
-- ---------------------------------------------------------------------
--
-- Rebased on 20260921000002_hardware_products.sql's definition — the fifth
-- rewrite of this function. Every prior branch is carried forward: the
-- credential sale, the gift-card delivery, the cost lock across all three
-- product families, and the audit row.
--
-- The new guard is first, before any state changes. Enforced HERE rather
-- than only in the admin UI because this is the function that actually
-- releases goods to a buyer: a screenshot is the evidence the payment was
-- made, and approving without one is exactly the mistake the UI gate is
-- meant to prevent. A disabled button is a hint; this is the rule.
--
-- reject_order is deliberately NOT gated. An order that never got a
-- screenshot is precisely the kind an admin needs to be able to reject.
create or replace function public.approve_order(p_order_id uuid, p_admin_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status not in ('under_review', 'payment_claimed') then
    raise exception 'INVALID_TRANSITION';
  end if;

  if not exists (select 1 from public.payment_screenshots s where s.order_id = p_order_id) then
    raise exception 'NO_PAYMENT_SCREENSHOT';
  end if;

  update public.orders
  set status = 'approved', reviewed_by = p_admin_id, reviewed_at = now()
  where id = p_order_id
  returning * into v_order;

  update public.game_credentials
  set status = 'sold', sold_at = now()
  where id in (
    select credential_id from public.order_items
    where order_id = p_order_id and credential_id is not null
  );

  update public.gift_card_codes
  set status = 'delivered', delivered_at = now()
  where id in (
    select gift_card_code_id from public.order_items
    where order_id = p_order_id and gift_card_code_id is not null
  );

  update public.order_items oi
  set cost_price = public.cost_price_at(
        oi.game_id,
        oi.variant_id,
        (select c.product_id from public.gift_card_codes c where c.id = oi.gift_card_code_id),
        oi.hardware_product_id,
        now()
      ),
      cost_locked_at = now()
  where oi.order_id = p_order_id
    and oi.cost_price is null;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    p_admin_id,
    'order_approved',
    'order',
    p_order_id,
    jsonb_build_object('order_id', p_order_id, 'amount', v_order.amount_exact)
  );

  return v_order;
end;
$$;
