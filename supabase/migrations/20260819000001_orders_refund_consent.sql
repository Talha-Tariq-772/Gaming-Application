-- src/types/database.ts's Order.refundPolicyConsentedAt is a required field
-- already read/written throughout the checkout/admin UI, but no column for
-- it exists yet — added here so the real order lifecycle can persist it.
alter table public.orders add column refund_policy_consented_at timestamptz;
