-- Admin-managed FAQ entries, replacing the hardcoded MOCK_FAQ_ITEMS in
-- src/lib/mock-guides.ts (which stays, still serving the mock general-help
-- `Guide` content — only the FAQ half moves to the database here).
--
-- `slug`, not `id`, is what the public page renders as each <details>
-- element's DOM id: three places already deep-link to specific answers by
-- their mock id (StepConfirmation.tsx via PAYMENT_VERIFICATION_FAQ_ID, and
-- two /faq#... links in legal-content.ts). Keying the anchor off a stable,
-- human-readable slug — seeded below with exactly those mock ids — keeps
-- every one of those links working; a uuid anchor would have silently
-- broken all three.
create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  question text not null,
  answer text not null,
  -- Same four values as GUIDE_CATEGORIES (src/types/database.ts). Nullable:
  -- an uncategorised entry is allowed and renders in its own trailing
  -- group on /faq rather than disappearing.
  category text check (category is null or category in ('getting-started', 'payment', 'account-setup', 'troubleshooting')),
  sort_order smallint not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_faqs_published on public.faqs (category, sort_order) where is_published = true;

alter table public.faqs enable row level security;

-- Admins also see unpublished drafts — same shape as setup_guides_select
-- (20260831000001_setup_guides.sql) and news_posts_select.
create policy "faqs_select" on public.faqs
  for select
  using (is_published = true or public.current_profile_role() = 'admin');

create policy "faqs_admin_all" on public.faqs
  for all
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

grant select on public.faqs to anon;
grant select, insert, update, delete on public.faqs to authenticated;
grant all on public.faqs to service_role;

-- Seed: the 12 entries previously hardcoded in MOCK_FAQ_ITEMS, slugs kept
-- byte-identical to their old mock ids so existing /faq#... links resolve.
insert into public.faqs (slug, question, answer, category, sort_order, is_published) values
  ('faq-how-verification-works', 'How does payment verification work?', 'Every payment is checked manually by our team rather than through an automatic gateway. At checkout we give you an exact amount to send (with a small unique offset added to your total) — that''s how we match your payment to your order. Send that exact amount, then tap "I have made the payment" and share your screenshot on WhatsApp so we can confirm it.', 'payment', 1, true),
  ('faq-verification-time', 'How long does verification take?', 'Usually 1–2 hours during business hours (9am–9pm PKT). Orders sent outside those hours are picked up first thing the next morning. Weekends and public holidays can take a little longer.', 'payment', 2, true),
  ('faq-agent-not-replied', 'I sent my screenshot but no one has replied — what do I do?', 'First, check that your 45-minute reservation window hasn''t expired — if it has, your order will show as expired and you''ll need to check out again. If it''s still active and you''re within business hours, give it a little longer; during busy periods responses can take a bit past our usual turnaround. If it''s been more than a few hours during business hours with no reply, send a follow-up message on the same WhatsApp thread with your order reference — don''t open a new chat, as that can split your conversation across two threads.', 'payment', 3, true),
  ('faq-payment-methods', 'What payment methods do you accept?', 'Bank transfer, JazzCash, Easypaisa, SadaPay, and NayaPay. See our accepted payment methods guide for details on each.', 'payment', 4, true),
  ('faq-refund-policy', 'What''s your refund policy?', 'If we can''t deliver a working account or key for an approved order — and can''t fix or replace it — we''ll issue a refund or store credit at your choice. Refunds aren''t available simply for a change of mind after credentials have been revealed, since the account is considered delivered at that point. If a payment was sent but never verified (for example, the reservation expired before we could match it), contact us with proof of payment and we''ll sort it out.', 'payment', 5, true),
  ('faq-access-credentials', 'How do I access my game credentials after I''m approved?', 'Go to My Orders, open the approved order, and use the Reveal Credentials button under each game. Credentials are shown once — save them somewhere safe as soon as you reveal them.', 'account-setup', 1, true),
  ('faq-change-credentials', 'Can I change the password on my game account?', 'We''d rather you didn''t — these are shared-pool accounts we''re still responsible for managing, and a password change can lock us out or flag the account on the platform''s side. If you have a specific reason to change it, message us first and we''ll help you do it safely.', 'account-setup', 2, true),
  ('faq-need-account', 'Do I need to create an account before I can order?', 'No separate signup step — placing your first order creates your account automatically using the name and phone number you provide at checkout.', 'account-setup', 3, true),
  ('faq-account-stopped-working', 'What happens if my game account stops working?', 'Message us with your order reference and what''s happening. We''ll restore access, swap you to a working account, or issue store credit/refund depending on the situation. See our full guide on this for more detail on what to expect.', 'troubleshooting', 1, true),
  ('faq-key-not-working', 'My game key won''t redeem — what should I do?', 'Double-check you''ve copied the code exactly with no extra spaces, and that you''re signed into the right platform account. Avoid retrying more than 2–3 times, since some platforms temporarily lock further attempts. If it still doesn''t work, message us on WhatsApp with your order reference and a screenshot of the error.', 'troubleshooting', 2, true),
  ('faq-how-to-redeem', 'How do I redeem my game after I''m approved?', 'It depends on your platform — see our full redemption guide for step-by-step instructions covering PC, PlayStation 5, Xbox, and Nintendo Switch.', 'getting-started', 1, true),
  ('faq-platforms-supported', 'Which platforms do you support?', 'PC (via Steam), PlayStation 5, Xbox Series X|S and Xbox One, and Nintendo Switch. Each game''s product page shows which platform it''s for before you buy.', 'getting-started', 2, true)
;
