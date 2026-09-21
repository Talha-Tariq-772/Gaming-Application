-- Site-wide public copy rewrite: FAQ entries and setup guides.
--
-- Removes language that explicitly describes the business mechanism —
-- online account creation, account credentials being sold, and
-- credentials/codes being delivered over WhatsApp — from customer-facing
-- copy. NOTHING about the order flow changes: approve_order, the reveal
-- path, and the WhatsApp handoff all behave exactly as before. This is
-- text only.
--
-- Why a migration rather than editing rows directly: these two tables are
-- seeded by 20260920000001_faqs.sql and 20260831000002_seed_setup_guides.sql,
-- so a live-only UPDATE would leave any freshly-migrated environment
-- serving the old copy. Same convention 20260823000002_seed_real_payment_
-- methods.sql used to correct seeded data.
--
-- SCOPE NOTE: the legal pages (Terms / Privacy / Refund) live in
-- src/lib/legal-content.ts and are deliberately NOT touched here. Their
-- shared-pool and third-party-processor disclosures look like intentional
-- risk/compliance statements rather than marketing copy, and the refund
-- page is wired to a checkout consent gate.

-- ---------------------------------------------------------------------
-- FAQs
-- ---------------------------------------------------------------------

update public.faqs set
  question = 'How do I get my order after I''m approved?',
  answer = 'Go to My Orders, open the approved order, and use the Reveal button on each item. Details are shown once — save them somewhere safe as soon as you reveal them.'
where slug = 'faq-access-credentials';

update public.faqs set
  question = 'Can I change the sign-in details on my order?',
  answer = 'Please don''t — we manage these on our side, and changing them can cut off your own access and void replacement or refund cover on your order. If you have a specific reason to change something, message us first and we''ll help you do it safely.'
where slug = 'faq-change-credentials';

-- The "online account creation" case the brief names directly.
update public.faqs set
  question = 'Do I need to sign up before I can order?',
  answer = 'No separate signup step — just place your order with the name and phone number you provide at checkout.'
where slug = 'faq-need-account';

update public.faqs set
  question = 'How does payment confirmation work?',
  answer = 'At checkout we give you an exact amount to send, with a small unique offset added to your total — that''s how we match your payment to your order. Send that exact amount, then tap "I have made the payment" and we''ll confirm it from there.'
where slug = 'faq-how-verification-works';

update public.faqs set
  question = 'What happens if something stops working after delivery?',
  answer = 'Message us with your order reference and what''s happening. We''ll restore your access, swap you to a working replacement, or issue store credit or a refund depending on the situation. See our full guide on this for more detail on what to expect.'
where slug = 'faq-account-stopped-working';

update public.faqs set
  answer = 'If we can''t deliver a working item for an approved order — and can''t fix or replace it — we''ll issue a refund or store credit at your choice. Refunds aren''t available simply for a change of mind once an order has been revealed, since it''s considered delivered at that point. If a payment was sent but never confirmed (for example, the reservation expired before we could match it), contact us with proof of payment and we''ll sort it out.'
where slug = 'faq-refund-policy';

update public.faqs set
  question = 'I''ve paid but haven''t heard back — what do I do?',
  answer = 'First, check that your 45-minute reservation window hasn''t expired — if it has, your order will show as expired and you''ll need to check out again. If it''s still active and you''re within business hours, give it a little longer; during busy periods responses can take a bit past our usual turnaround. If it''s been more than a few hours during business hours with no reply, send a follow-up on the same thread with your order reference — don''t open a new chat, as that can split your conversation across two threads.'
where slug = 'faq-agent-not-replied';

-- Only the closing sentence changes here: "the right platform account"
-- refers to the BUYER's own Steam/PSN/Xbox profile, which is practical
-- instruction, not a description of what we sell.
update public.faqs set
  answer = 'Double-check you''ve copied the code exactly with no extra spaces, and that you''re signed in on the right platform profile. Avoid retrying more than 2–3 times, since some platforms temporarily lock further attempts. If it still doesn''t work, message us with your order reference and a screenshot of the error.'
where slug = 'faq-key-not-working';

-- ---------------------------------------------------------------------
-- Setup guides (rendered on product pages and /guides)
-- ---------------------------------------------------------------------
--
-- The console-sharing steps stay verbatim: a buyer physically cannot use
-- the product without them, and they are practical instruction rather
-- than a statement of the business model. What goes is the framing around
-- them — "delivered as full account credentials", "shared-pool accounts",
-- the screenshot/WhatsApp delivery description, and the
-- "You Have Access, Not Ownership" section.

update public.setup_guides set
  title = 'Setting Up Your PS4 / PS5',
  body = $guide$Follow the steps for your console below to start playing.

## How It Works

1. Place your order and pay the exact amount shown at checkout.
2. Tap **I have made the payment** to confirm it, quoting your order reference.
3. We check the payment against your order — usually within 1–2 hours during business hours.
4. Once approved, go to **My Orders**, open the order, and tap **Reveal** to get everything you need.

## Setting Up on PS5

1. On your PS5, sign in using the details from your order page — not your own PSN profile.
2. Go to **Settings → Users and Accounts → Other → Console Sharing and Offline Play**.
3. Select **Enable Console Sharing and Offline Play**.

Once enabled, your PS5 becomes the primary console. You can then sign back into your own PSN profile on the same console and play anything downloaded — offline, using your own saves and trophies.

Only one console at a time. If it was previously enabled on a different PS5, enabling it on yours automatically removes it from that one.

## Setting Up on PS4

PS4 uses an older version of the same idea, called activating a primary console:

1. Sign in on your PS4 using the details from your order page.
2. Go to **Settings → Account Management → Activate as Primary PS4**.
3. Confirm the activation.

Same rule as PS5: only one PS4 can be the primary console at a time.

## Primary vs Secondary — What's the Difference

- **Primary console** (the one you just activated): any local profile signed in on that console — including your own — can play offline, with your own saves and trophies. This is what you want for normal, everyday play.
- **Secondary console**: you can still play, but only while signed in directly (not under your own profile), and only with an active internet connection. There's no offline play, and no separate save data of your own.

Almost everyone wants their console set as primary. Only skip this if you're just trying it out briefly on a console you don't own.

## What You Must Not Do

Don't change the sign-in email or password. Changing either one cuts off your own access, and voids replacement or refund cover for your order. If you have a specific reason to want it changed, message us first and we'll walk you through it safely.$guide$
where slug = 'ps4-ps5-account-setup';

update public.setup_guides set
  title = 'Activating Your Membership',
  body = $guide$How you activate your membership depends on which platform it's for.

## How It Works

1. Place your order and pay the exact amount shown at checkout.
2. Tap **I have made the payment** to confirm it, quoting your order reference.
3. We check the payment against your order — usually within 1–2 hours during business hours.
4. Once approved, go to **My Orders**, open the order, and tap **Reveal** to get everything you need.

## PlayStation Plus & PS Plus Extra/Premium

These set up the same way as our PlayStation games — see the [PS4/PS5 setup guide](/guides/ps4-ps5-account-setup) for full steps. In short:

- **PS5:** sign in using the details from your order, then Settings → Users and Accounts → Other → Console Sharing and Offline Play → Enable.
- **PS4:** sign in using the details from your order, then Settings → Account Management → Activate as Primary PS4.

Once your console is set as the primary console, sign back into your own PSN profile — your PS Plus benefits (online play, monthly games, cloud storage, and the Extra/Premium catalog if you bought that tier) apply to your profile on that console. Same one-console-at-a-time rule applies: enabling it on your console removes it from wherever it was primary before.

## Xbox Game Pass Ultimate

1. On your Xbox console, the Xbox app (PC), or the Xbox Cloud Gaming site, sign in using the details from your order page — not your own Microsoft profile.
2. Game Pass Ultimate is active immediately: browse Game Pass from the home screen and install or stream anything in the catalog.
3. To play under your own gamertag instead: while still signed in, go to Settings → General → Personalization → My home Xbox → Make this my home Xbox. Your own profile can then install and play from the Game Pass library, including mostly-offline play — Xbox re-checks the licence online roughly every 30 days, so reconnect occasionally.
4. Only one console can be set as the home Xbox at a time, same as the PlayStation console-sharing limit above.

## What You Must Not Do

Don't change the sign-in email or password. Changing either one cuts off your own access, and voids replacement or refund cover for your order.$guide$
where slug = 'membership-account-setup';

-- ---------------------------------------------------------------------
-- Per-game setup text (games.setup_guide)
-- ---------------------------------------------------------------------
--
-- A free-text column an admin edits in the game form, distinct from the
-- setup_guides table above. It renders on the order page underneath a
-- revealed item, so it is customer-facing copy like everything else here.
-- Only one row currently carries any text at all.
update public.games set
  setup_guide = 'Sign in with the details shown above to start playing.'
where setup_guide ilike '%credential%';
