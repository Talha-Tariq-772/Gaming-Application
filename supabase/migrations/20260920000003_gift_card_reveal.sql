-- Gift-card code reveal tracking.
--
-- gift_card_codes already had delivered_at (stamped by approve_order when
-- the order is approved), but no record of the customer actually SEEING
-- the code — because there was no way to see it at all: the account order
-- page rendered a credentials section that silently skipped every
-- gift-card line, so an approved gift-card order showed an empty panel and
-- the buyer could never retrieve what they paid for.
--
-- These mirror game_credentials.revealed_at/revealed_ip exactly, so the
-- two secret types are auditable the same way: delivered_at = "we handed
-- it over", revealed_at = "they looked at it, first time".
alter table public.gift_card_codes
  add column revealed_at timestamptz,
  add column revealed_ip text;

comment on column public.gift_card_codes.revealed_at is
  'First time the buyer revealed this code in their account. Distinct from delivered_at (set at approval). Never overwritten on repeat views — audit_log records every access.';

-- 20260920000002_cost_price.sql revoked table-wide SELECT on order_items
-- and re-granted it column by column; gift_card_codes was never part of
-- that lockdown and keeps its existing grants. Nothing to change here —
-- noted so the next person doesn't go looking for a missing grant.
