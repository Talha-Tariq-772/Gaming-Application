-- Revenue broken down by the payment method money actually arrived through.
--
-- The storefront takes bank transfer and wallet payments only (see
-- 20260823000002_seed_real_payment_methods.sql), and each order records
-- which receiving account the customer was told to send to via
-- orders.payment_method_id. Nothing has ever aggregated that, so there
-- was no way to answer "how much came in through JazzCash this month?"
-- without exporting orders by hand.
--
-- REVENUE RECOGNITION: identical to the profit report
-- (20260920000002_cost_price.sql) and src/lib/admin-stats.ts — only
-- status = 'approved' counts, dated on reviewed_at. An order that was
-- merely created, or whose payment claim has not been reviewed yet, is
-- not revenue: approval is the point an admin has confirmed the transfer
-- landed. Keeping the gate here (rather than in application code) means
-- it cannot drift from the gate approve_order itself enforces.
--
-- WHICH AMOUNT: orders.amount_exact, not sum(order_items.price). This
-- report answers "what hit this account", and amount_exact is literally
-- the figure the customer was instructed to transfer — cart total plus
-- the paisa reconciliation offset generate_unique_amount() adds
-- (20260818000009_functions.sql). That offset is under Rs 1 per order,
-- so this total runs a few rupees above the Profit page's revenue, which
-- sums line prices instead. Deliberate: matching the bank statement
-- matters more here than matching the other report to the paisa.

-- ---------------------------------------------------------------------
-- Revenue and still-pending volume per payment method
-- ---------------------------------------------------------------------
--
-- Pending orders are returned alongside revenue rather than filtered out
-- silently. Two reasons: an admin looking at a low JazzCash figure needs
-- to see whether the money is genuinely absent or just sitting unreviewed,
-- and surfacing the excluded amount makes the exclusion auditable instead
-- of invisible. They are counted in separate columns and never added into
-- `revenue`.
--
-- The two halves are dated on different columns on purpose: an approved
-- order belongs to the window it was APPROVED in (reviewed_at, the
-- revenue-recognition rule above), while a pending order has no
-- reviewed_at at all — it is null until someone reviews it — so it is
-- dated on created_at instead. Dating pending orders on reviewed_at would
-- exclude every one of them, silently reporting zero pending forever.
--
-- 'rejected' and 'expired' appear in neither figure. They are closed,
-- unpaid outcomes, not money in transit; counting them as pending would
-- imply revenue that is never arriving.
create or replace function public.get_revenue_by_payment_method(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now()
)
returns table (
  payment_method_id uuid,
  label text,
  orders_count bigint,
  revenue numeric,
  pending_orders bigint,
  pending_amount numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pm.id as payment_method_id,
    -- LEFT JOIN + coalesce, not an inner join: orders.payment_method_id is
    -- nullable, and dropping those rows would quietly shrink the grand
    -- total below the real one. They group together under one row instead.
    coalesce(pm.label, 'Not recorded') as label,
    count(*) filter (where o.status = 'approved')::bigint as orders_count,
    coalesce(sum(o.amount_exact) filter (where o.status = 'approved'), 0)::numeric as revenue,
    count(*) filter (
      where o.status in ('awaiting_payment', 'payment_claimed', 'under_review')
    )::bigint as pending_orders,
    coalesce(sum(o.amount_exact) filter (
      where o.status in ('awaiting_payment', 'payment_claimed', 'under_review')
    ), 0)::numeric as pending_amount
  from public.orders o
  left join public.payment_methods pm on pm.id = o.payment_method_id
  where (
      o.status = 'approved'
      and o.reviewed_at is not null
      and o.reviewed_at >= p_from
      and o.reviewed_at <= p_to
    )
    or (
      o.status in ('awaiting_payment', 'payment_claimed', 'under_review')
      and o.created_at >= p_from
      and o.created_at <= p_to
    )
  group by pm.id, coalesce(pm.label, 'Not recorded')
  order by revenue desc, label asc;
$$;

-- Same lockdown as the profit functions: security definer reads every
-- order row regardless of RLS, so no client role may execute it. The
-- authorization boundary is requireAdmin() in src/lib/payment-revenue.ts,
-- reached only through the service client.
revoke all on function public.get_revenue_by_payment_method(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_revenue_by_payment_method(timestamptz, timestamptz)
  to service_role;
