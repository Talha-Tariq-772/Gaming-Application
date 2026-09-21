-- Second copy pass: payment proof is uploaded in-app now.
--
-- 20260921000004 reworded this content while the mechanism was still
-- "send a screenshot over WhatsApp". 20260921000005 changed the mechanism
-- itself, so the earlier wording is no longer merely awkward — it is
-- wrong. This corrects the FAQ and guide copy to describe what the site
-- actually does.
--
-- WhatsApp remains a support channel throughout; what it is no longer is
-- the route payment evidence travels.

update public.faqs set
  question = 'How does payment confirmation work?',
  answer = 'At checkout we give you an exact amount to send, with a small unique offset added to your total — that''s how we match your payment to your order. Send that exact amount, then upload a screenshot of the transaction on the confirmation screen. We check it against your order before approving.'
where slug = 'faq-how-verification-works';

update public.faqs set
  question = 'I''ve uploaded my payment proof but haven''t heard back — what do I do?',
  answer = 'First, check that your 45-minute reservation window hasn''t expired — if it has, your order will show as expired and you''ll need to check out again. If it''s still active and you''re within business hours, give it a little longer; during busy periods responses can take a bit past our usual turnaround. If it''s been more than a few hours during business hours, message us with your order reference.'
where slug = 'faq-agent-not-replied';

-- New entry: the single most likely question now that the mechanism has
-- changed, and there was nothing covering it.
insert into public.faqs (slug, question, answer, category, sort_order, is_published)
values (
  'faq-upload-payment-proof',
  'How do I upload proof of payment?',
  'On the confirmation screen at the end of checkout, drag your screenshot in or tap Choose screenshot — PNG, JPEG or WebP, up to 10MB. If you''re signed in you can also do it later from My Orders. Checking out as a guest gives you a private link to your order instead, which works the same way and needs no sign-in. You can replace the image any time before we review it.',
  'payment',
  3,
  true
)
on conflict (slug) do update set
  question = excluded.question,
  answer = excluded.answer,
  category = excluded.category,
  is_published = excluded.is_published;

-- ---------------------------------------------------------------------
-- Setup guides: the delivery-steps block in each
-- ---------------------------------------------------------------------

update public.setup_guides set
  body = replace(
    body,
    '2. Tap **I have made the payment** to confirm it, quoting your order reference.',
    '2. Tap **I have made the payment**, then upload a screenshot of the transaction.'
  )
where body like '%I have made the payment%';
